<?php

namespace WebKernel;

use DynamicalWeb\WebSession;
use DynamicalWeb\Classes\Logger;


use DynamicalWeb\Html\Functions;
use FederationLib\FederationClient;

/**
 * Prepares API specification data for rendering.
 */
class ApiSpecificationView
{
    private ?string $error = null;
    /** @var array<string, mixed> OpenAPI specification document. */
    private array $spec = [];

    /** @var array<string, mixed> OpenAPI metadata. */
    private array $specInfo = [];

    /** @var array<string, array<string, mixed>> OpenAPI component schemas keyed by name. */
    private array $schemas = [];

    /** @var list<array<string, mixed>> OpenAPI server definitions. */
    private array $specServers = [];

    /** @var array<string, mixed>|null External OpenAPI documentation details. */
    private ?array $externalDocs = null;

    /** @var array<string, array<string, mixed>> OpenAPI tags keyed by name. */
    private array $tagMap = [];

    /** @var array<string, list<array{path: string, method: string, details: array<string, mixed>}>> Endpoint definitions grouped by tag. */
    private array $endpointsByTag = [];


    private FederationClient $federationClient;

    /**
     * ApiSpecificationView constructor.
     */
    public function __construct()
    {
        $this->federationClient = WebSession::get('federation_client');

        $error = null;
        $spec = null;
        try {
            $spec = WebSession::get('specification') ?? $this->federationClient->getSpecification();
        } catch (\Exception $exception) {
            Logger::getLogger()->warning('Unable to load API specification', $exception);
            $error = $exception->getMessage();
        }
        $specInfo = $spec['info'] ?? [];
        $paths = $spec['paths'] ?? [];
        $tags = $spec['tags'] ?? [];
        $schemas = $spec['components']['schemas'] ?? [];
        $specServers = $spec['servers'] ?? [];
        $externalDocs = $spec['externalDocs'] ?? null;
        $tagMap = [];
        foreach ($tags as $tag) {
            $tagMap[$tag['name']] = $tag;
        }
        $endpointsByTag = [];
        foreach ($paths as $path => $methods) {
            foreach ($methods as $method => $details) {
                if (!is_array($details)) {
                    continue;
                }
                foreach ($details['tags'] ?? ['General'] as $tag) {
                    $endpointsByTag[$tag][] = ['path' => $path, 'method' => strtoupper($method), 'details' => $details];
                }
            }
        }
        $tagOrder = array_keys($tagMap);
        uksort($endpointsByTag, static function ($a, $b) use ($tagOrder): int {
            $aIndex = array_search($a, $tagOrder);
            $bIndex = array_search($b, $tagOrder);
            if ($aIndex === false && $bIndex === false) return strcasecmp($a, $b);
            if ($aIndex === false) return 1;
            if ($bIndex === false) return -1;
            return $aIndex - $bIndex;
        });
        $this->error = $error;
        $this->spec = $spec ?? [];
        $this->specInfo = $specInfo;
        $this->schemas = $schemas;
        $this->specServers = $specServers;
        $this->externalDocs = $externalDocs;
        $this->tagMap = $tagMap;
        $this->endpointsByTag = $endpointsByTag;
    }


    /**
     * Returns a URL from the specification when it is safe to use as a link.
     *
     * <p>The specification comes from the connected server, so its links are only followed when
     * they are web addresses; a javascript: or data: URL would run in this site's origin.
     *
     * @param mixed $url The URL from the specification.
     * @return string|null The URL, or null when it is not an http(s) address.
     */
    public static function safeUrl(mixed $url): ?string
    {
        if (!is_string($url)) return null;
        $scheme = strtolower((string)parse_url(trim($url), PHP_URL_SCHEME));
        return in_array($scheme, ['http', 'https'], true) ? $url : null;
    }

    /**
     * Determine whether the current session uses dark mode.
     *
     * @return bool True when dark mode is enabled.
     */
    public function getDarkMode(): bool { return Utilities::getDarkMode(); }
    /**
     * Retrieve the API specification loading error.
     *
     * @return string|null Loading error message, or null when the specification loaded successfully.
     */
    public function getError(): ?string { return $this->error; }
    /**
     * Retrieve the complete API specification.
     *
     * @return array OpenAPI specification document.
     */
    public function getSpec(): array { return $this->spec; }
    /**
     * Retrieve the API specification metadata.
     *
     * @return array OpenAPI information section.
     */
    public function getSpecInfo(): array { return $this->specInfo; }
    /**
     * Retrieve the API component schemas.
     *
     * @return array OpenAPI schemas keyed by name.
     */
    public function getSchemas(): array { return $this->schemas; }
    /**
     * Retrieve the API server definitions.
     *
     * @return array OpenAPI server definitions.
     */
    public function getSpecServers(): array { return $this->specServers; }
    /**
     * Retrieve the external API documentation details.
     *
     * @return array|null External documentation details, or null when none are defined.
     */
    public function getExternalDocs(): ?array { return $this->externalDocs; }
    /**
     * Retrieve an API tag by name.
     *
     * @param string $name Name of the tag to retrieve.
     * @return array Tag definition, or an empty array when the tag is not defined.
     */
    public function getTag(string $name): array { return $this->tagMap[$name] ?? []; }
    /**
     * Retrieve API endpoints grouped by tag.
     *
     * @return array Endpoint definitions keyed by tag name.
     */
    public function getEndpointsByTag(): array { return $this->endpointsByTag; }

    /**
     * Determine the CSS badge class for an HTTP method.
     *
     * @param string $method HTTP method to classify.
     * @return string CSS class for the method badge.
     */
    public static function getMethodBadge(string $method): string
    {
        return match (strtolower($method)) {
            'get' => 'fw-badge-green', 'post' => 'fw-badge-blue', 'put', 'patch' => 'fw-badge-amber',
            'delete' => 'fw-badge-red', 'head' => 'fw-badge-gray', 'options' => 'fw-badge-purple', default => 'fw-badge-gray',
        };
    }

    /**
     * Determine display metadata for an OpenAPI schema.
     *
     * @param array $schema OpenAPI schema to inspect.
     * @param array $spec Complete OpenAPI specification used to resolve references.
     * @return array Display metadata describing the schema type.
     */
    public static function getSchemaType(array $schema, array $spec): array
    {
        if (isset($schema['$ref'])) {
            $name = current(array_reverse(explode('/', $schema['$ref'])));
            $resolved = self::resolveRef($schema['$ref'], $spec);
            if ($resolved) {
                $inner = self::getSchemaType($resolved, $spec);
                $inner['label'] = $name;
                $inner['ref'] = $schema['$ref'];
                return $inner;
            }
            return ['label' => $name, 'type' => 'ref', 'ref' => $schema['$ref']];
        }
        if (isset($schema['type'])) {
            $type = $schema['type'];
            if ($type === 'array' && isset($schema['items'])) {
                $itemType = self::getSchemaType($schema['items'], $spec);
                return ['label' => 'array<' . $itemType['label'] . '>', 'type' => 'array', 'items' => $itemType];
            }
            return ['label' => $type, 'type' => $type];
        }
        if (isset($schema['enum'])) return ['label' => 'enum', 'type' => 'enum', 'enum' => $schema['enum']];
        if (isset($schema['oneOf'])) return ['label' => 'oneOf', 'type' => 'oneOf', 'subs' => $schema['oneOf'], 'spec' => $spec];
        if (isset($schema['anyOf'])) return ['label' => 'anyOf', 'type' => 'anyOf', 'subs' => $schema['anyOf'], 'spec' => $spec];
        if (isset($schema['allOf'])) return ['label' => 'allOf', 'type' => 'allOf', 'subs' => $schema['allOf'], 'spec' => $spec];
        if (!empty($schema['properties'])) return ['label' => 'object', 'type' => 'object'];
        if (isset($schema['additionalProperties'])) return ['label' => 'map', 'type' => 'map'];
        return ['label' => 'mixed', 'type' => 'mixed'];
    }

    /**
     * Render an OpenAPI schema as inline HTML.
     *
     * @param array $schema OpenAPI schema to render.
     * @param array $spec Complete OpenAPI specification used to resolve references.
     * @return string HTML representation of the schema.
     */
    public static function renderSchemaInline(array $schema, array $spec): string
    {
        $visited = [];
        return self::renderSchemaProperties($schema, $spec, $visited, 0);
    }

    /**
     * Render an OpenAPI schema and its nested properties as HTML.
     *
     * @param array $schema OpenAPI schema to render.
     * @param array $spec Complete OpenAPI specification used to resolve references.
     * @param array $visitedRefs References visited while rendering nested schemas.
     * @param int $depth Current nesting depth.
     * @return string HTML representation of the schema properties.
     */
    public static function renderSchemaProperties(array $schema, array $spec, array &$visitedRefs = [], int $depth = 0): string
    {
        if ($depth > 15) return '<span class="fw-uuid">… (max depth)</span>';
        if (isset($schema['$ref'])) {
            if (isset($visitedRefs[$schema['$ref']])) return '<span class="fw-uuid">🔁 ' . self::escape($schema['$ref']) . ' (circular)</span>';
            $visitedRefs[$schema['$ref']] = true;
            $resolved = self::resolveRef($schema['$ref'], $spec);
            if ($resolved) {
                $result = self::renderSchemaProperties($resolved, $spec, $visitedRefs, $depth + 1);
                unset($visitedRefs[$schema['$ref']]);
                return $result;
            }
            unset($visitedRefs[$schema['$ref']]);
            return '<span class="fw-uuid">' . self::escape($schema['$ref']) . '</span>';
        }
        if (isset($schema['oneOf']) || isset($schema['anyOf']) || isset($schema['allOf'])) {
            $key = isset($schema['oneOf']) ? 'oneOf' : (isset($schema['anyOf']) ? 'anyOf' : 'allOf');
            $html = '';
            foreach ($schema[$key] as $index => $sub) {
                if (!is_array($sub)) continue;
                $schemaType = self::getSchemaType($sub, $spec);
                $html .= '<details class="fw-spec-composite"><summary class="fw-spec-composite-summary"><span class="fw-uuid">' . $key . ' [' . $index . ']</span> <span class="fw-badge fw-badge-sm ' . self::getMethodBadge($key) . '">' . self::escape($schemaType['label']) . '</span></summary><div class="fw-spec-composite-body">';
                $html .= self::renderSchemaProperties($sub, $spec, $visitedRefs, $depth + 1) . '</div></details>';
            }
            return $html;
        }
        if (isset($schema['type']) && $schema['type'] === 'array' && isset($schema['items'])) {
            if (!is_array($schema['items'])) return '<span class="fw-uuid">array</span>';
            $schemaType = self::getSchemaType($schema['items'], $spec);
            if (($schemaType['type'] ?? null) === 'object') return self::renderSchemaProperties($schema['items'], $spec, $visitedRefs, $depth + 1);
            if (isset($schema['items']['$ref'])) {
                $resolved = self::resolveRef($schema['items']['$ref'], $spec);
                if ($resolved) return self::renderSchemaProperties($resolved, $spec, $visitedRefs, $depth + 1);
            }
            return '<pre class="fw-schema-inline-json"><code>' . self::escape(json_encode($schema['items'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) . '</code></pre>';
        }
        if (isset($schema['properties'])) {
            $required = $schema['required'] ?? [];
            $html = '<div class="fw-schema-props">';
            foreach ($schema['properties'] as $propertyName => $propertySchema) {
                if (!is_array($propertySchema)) continue;
                $schemaType = self::getSchemaType($propertySchema, $spec);
                $html .= '<div class="fw-schema-prop"><div class="fw-schema-prop-header"><span class="fw-schema-prop-name fw-mono">' . self::escape($propertyName) . '</span><span class="fw-schema-prop-type"><span class="fw-badge fw-badge-sm ' . self::getMethodBadge($schemaType['type'] ?? 'object') . '">' . self::escape($schemaType['label']) . '</span></span>';
                if (in_array($propertyName, $required)) $html .= '<span class="fw-dot red" title="' . Utilities::localize('required_label') . '"></span>';
                if (!empty($propertySchema['description'])) $html .= '<span class="fw-schema-prop-desc">' . self::escape($propertySchema['description']) . '</span>';
                if (!empty($propertySchema['deprecated'])) $html .= '<span class="fw-badge fw-badge-red fw-badge-sm">' . Utilities::localize('deprecated') . '</span>';
                $html .= '</div>';
                if (isset($propertySchema['$ref']) || (($propertySchema['type'] ?? null) === 'object') || (($propertySchema['type'] ?? null) === 'array') || isset($propertySchema['oneOf']) || isset($propertySchema['anyOf']) || isset($propertySchema['allOf'])) $html .= '<div class="fw-schema-prop-detail">' . self::renderSchemaProperties($propertySchema, $spec, $visitedRefs, $depth + 1) . '</div>';
                $html .= '</div>';
            }
            $html .= '</div>';
            if (isset($schema['additionalProperties']) && is_array($schema['additionalProperties'])) $html .= '<div class="fw-schema-additional"><span class="fw-uuid">additionalProperties:</span> ' . self::renderSchemaProperties($schema['additionalProperties'], $spec, $visitedRefs, $depth + 1) . '</div>';
            return $html;
        }
        if (isset($schema['enum'])) return '<div class="fw-spec-subsection-item"><span class="fw-uuid">enum:</span> <span class="fw-mono">[' . implode(', ', array_map(static fn($value) => '"' . self::escape($value) . '"', $schema['enum'])) . ']</span></div>';
        return '<pre class="fw-schema-inline-json"><code>' . self::escape(json_encode($schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) . '</code></pre>';
    }

    /**
     * Resolve a local JSON pointer reference in an OpenAPI specification.
     *
     * @param string $ref Reference to resolve.
     * @param array $spec OpenAPI specification containing the reference target.
     * @return array|null Resolved schema data, or null when the reference is unsupported or missing.
     */
    private static function resolveRef(string $ref, array $spec): ?array
    {
        if (!str_starts_with($ref, '#/')) return null;
        $current = $spec;
        foreach (explode('/', trim(substr($ref, 2), '/')) as $part) {
            $key = str_replace('~1', '/', str_replace('~0', '~', $part));
            if (!isset($current[$key])) return null;
            $current = $current[$key];
        }
        return is_array($current) ? $current : null;
    }

    /**
     * Escape a value for safe inclusion in HTML.
     *
     * @param mixed $value Value to escape.
     * @return string HTML-escaped value.
     */
    private static function escape(mixed $value): string
    {
        return htmlspecialchars((string)$value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
