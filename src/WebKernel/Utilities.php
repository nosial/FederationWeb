<?php

    namespace WebKernel;

    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\Classes\RequestCache;
    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use FederationLib\Enums\ClassificationFlag;
    use FederationLib\Enums\ContentType;
    use FederationLib\Enums\IncidentType;
    use FederationLib\Exceptions\RequestException;
    use FederationLib\FederationClient;
    use FederationLib\Objects\EvidenceRecord;
    use FederationLib\Objects\ReportRecord;
    use FederationLib\Objects\ServerInformation;

    /**
     * Provides common web application utility functions.
     */
    class Utilities
    {
        /**
         * Query parameters that carry a status message to the page a redirect leads to. {@see Utilities::redirect()}
         * moves them into the cookie session instead, so they never appear in an address that can be shared or
         * crafted; error_message in particular carries unlocalized text.
         */
        private const array STATUS_PARAMETERS = ['success', 'error', 'error_message'];

        /**
         * The major version of the OFD interface this web application implements. Implementations of different
         * major versions are not expected to interoperate (OFD "Versioning").
         */
        public const int SUPPORTED_API_MAJOR_VERSION = 2;

        /** The entity host of telephone entities (OFD "Telephone Entities"). */
        private const string TELEPHONE_ENTITY_HOST = 'e164.arpa';

        /**
         * Returns whether the server implements the major version of the OFD interface this web application
         * implements, judged by the api_version it publishes.
         *
         * @param ServerInformation $serverInformation The server information.
         * @return bool True when the major version of the server is supported.
         */
        public static function isSupportedApiVersion(ServerInformation $serverInformation): bool
        {
            $major = explode('.', $serverInformation->getApiVersion(), 2)[0];
            return ctype_digit($major) && (int)$major === self::SUPPORTED_API_MAJOR_VERSION;
        }

        /**
         * Returns whether the server rejected a request because it limits the rate of its requests (OFD 2.2 "Rate
         * Limiting"), with HTTP 429. The server did not perform the request, which may be repeated later.
         *
         * @param \Throwable $exception The failure of the request.
         * @return bool True when the request was rejected with HTTP 429.
         */
        public static function isRateLimited(\Throwable $exception): bool
        {
            return $exception instanceof RequestException && $exception->getCode() === 429;
        }

        /**
         * Returns whether an entity identifier refers to a telephone entity. An address is recognized by its
         * host, any other identifier (a UUID or SHA-256 identifier) by looking the entity up.
         *
         * @param FederationClient $client The client to query.
         * @param string $identifier The entity identifier.
         * @return bool True when the identifier refers to a telephone entity, false when it does not or the
         *              entity cannot be looked up.
         */
        public static function isTelephoneEntity(FederationClient $client, string $identifier): bool
        {
            $identifier = trim($identifier);
            if(str_contains($identifier, '@'))
            {
                return strtolower(substr($identifier, strrpos($identifier, '@') + 1)) === self::TELEPHONE_ENTITY_HOST;
            }

            try
            {
                return $client->getEntityRecord($identifier)->isTelephone();
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to look up the entity of submitted evidence', $exception);
                return false;
            }
        }

        /**
         * Reads the content type and context submitted with evidence. The context keeps only the non-empty values
         * of the keys defined for the content type, the server validates the rest.
         *
         * @param mixed $contentType The submitted content type, TEXT when absent or not a content type.
         * @param mixed $context The submitted context, a map of context keys to values.
         * @return array{0: ContentType, 1: array<string, string>|null} The content type and the context, null
         *         when it holds no value.
         */
        public static function readContentInput(mixed $contentType, mixed $context): array
        {
            $type = is_string($contentType) ? (ContentType::tryFromCaseInsensitive(trim($contentType)) ?? ContentType::TEXT) : ContentType::TEXT;
            $values = [];
            if(is_array($context))
            {
                foreach($type->getContextKeys() as $key)
                {
                    $value = $context[$key] ?? null;
                    if(is_string($value) && trim($value) !== '')
                    {
                        $values[$key] = trim($value);
                    }
                }
            }

            return [$type, empty($values) ? null : $values];
        }

        /**
         * Reads the concerns requested for an entity query, keeping only those the server can assess.
         *
         * @param mixed $value The concerns, as an array or a comma-separated string of incident types.
         * @param ServerInformation $serverInformation The server information.
         * @return IncidentType[]|null The concerns, or null when none are requested or the server does not
         *                             publish its concerns, in which case it assesses its default concerns.
         */
        public static function readConcerns(mixed $value, ServerInformation $serverInformation): ?array
        {
            $available = $serverInformation->getConcerns();
            if($available === null || $value === null || $value === '' || $value === [])
            {
                return null;
            }

            $concerns = array_values(array_filter(IncidentType::parseList($value) ?? [],
                static fn(IncidentType $concern): bool => in_array($concern, $available, true)
            ));

            return empty($concerns) ? null : $concerns;
        }

        /**
         * Returns the badge CSS class for an incident type.
         *
         * @param IncidentType $type The incident type.
         * @return string The badge CSS class.
         */
        public static function getIncidentBadge(IncidentType $type): string
        {
            return match($type)
            {
                IncidentType::MALWARE, IncidentType::ILLEGAL_CONTENT => 'fw-badge-red',
                IncidentType::SPAM, IncidentType::SCAM => 'fw-badge-amber',
                IncidentType::PHISHING => 'fw-badge-blue',
                IncidentType::SERVICE_ABUSE => 'fw-badge-purple',
                IncidentType::ADVERTISING, IncidentType::TRACKING => 'fw-badge-cyan',
                default => 'fw-badge-gray',
            };
        }

        /**
         * Determine whether the current session uses dark mode.
         *
         * @return bool True when dark mode is enabled.
         */
        public static function getDarkMode(): bool
        {
            $cookieSession = WebSession::get('cookie_session');

            return (bool)($cookieSession?->get('dark_mode', true) ?? true);
        }

        /**
         * Retrieve redirect status metadata from the request query string.
         *
         * @return StatusMessages Typed status metadata for view consumption.
         */
        public static function getStatusMessages(): StatusMessages
        {
            // Message keys can still come from the query string, so only keys the locale defines are shown;
            // anything else would make the page fail to render.
            return new StatusMessages(
                successMessageKey: self::localeKeyOrNull(self::getRedirectStatus('success')),
                errorMessageKey: self::localeKeyOrNull(self::getRedirectStatus('error')),
                errorDetail: self::getRedirectStatus('error_message'),
            );
        }

        /**
         * Returns a status value passed on by {@see Utilities::redirect()}: the one flashed into the cookie session,
         * or for success and error, the query parameter of the same name (links such as the login page's errors).
         *
         * <p>A flashed value is removed when it is read, so the result is kept for the rest of the request.
         *
         * @param string $key One of success, error or error_message.
         * @return string|null The value, or null when none was passed on.
         */
        public static function getRedirectStatus(string $key): ?string
        {
            return RequestCache::remember('fw_redirect_status:' . $key, static function() use ($key): ?string
            {
                $value = WebSession::getFlash($key);

                // Without cookie sessions nothing could be flashed, so redirect() left the value in the query string
                if($value === null && ($key !== 'error_message' || WebSession::getCookieSessionManager() === null))
                {
                    $value = WebSession::getRequest()->getQueryParameters()[$key] ?? null;
                }

                return is_string($value) && $value !== '' ? $value : null;
            });
        }

        /**
         * Returns a localized string for the current route's locale section, falling back to the
         * global section. Unlike {@see Functions::printl()}, which prints, this returns the text.
         *
         * @param string $key The locale key.
         * @param array $parameters Placeholder replacements.
         * @return string The localized text, or the key itself when it is not defined.
         */
        public static function localize(string $key, array $parameters=[]): string
        {
            $section = WebSession::getCurrentRoute()?->getLocaleId() ?? 'global';
            return WebSession::getLocale()?->getString($section, $key, $parameters) ?? $key;
        }

        /**
         * Returns the key when the current locale defines it, or null otherwise.
         *
         * @param mixed $key The candidate locale key.
         * @return string|null The key, or null when it is missing, not a string or not defined.
         */
        private static function localeKeyOrNull(mixed $key): ?string
        {
            if(!is_string($key) || $key === '')
            {
                return null;
            }

            $section = WebSession::getCurrentRoute()?->getLocaleId() ?? 'global';
            return WebSession::getLocale()?->getString($section, $key) !== null ? $key : null;
        }

        /**
         * Format a Unix timestamp for display.
         *
         * @param int $timestamp Unix timestamp to format.
         * @param string $format PHP date format to apply.
         * @return string Formatted date, or an em dash for a non-positive timestamp.
         */
        public static function formatDate(int $timestamp, string $format='Y-m-d H:i'): string
        {
            return $timestamp > 0 ? date($format, $timestamp) : '—';
        }

        /**
         * Format a number of bytes for display.
         *
         * @param int $bytes The number of bytes to format.
         * @return string The human-readable size, or an em dash for a non-positive size.
         */
        public static function formatSize(int $bytes): string
        {
            if($bytes <= 0) return '—';
            if($bytes >= 1073741824) return round($bytes / 1073741824, 1) . ' GB';
            if($bytes >= 1048576) return round($bytes / 1048576, 1) . ' MB';
            if($bytes >= 1024) return round($bytes / 1024, 1) . ' KB';
            return $bytes . ' B';
        }

        /**
         * Returns the badge CSS class for an evidence classification.
         *
         * @param ClassificationFlag|null $classification The evidence classification.
         * @return string The badge CSS class.
         */
        public static function getClassificationBadge(?ClassificationFlag $classification): string
        {
            return match($classification)
            {
                ClassificationFlag::MALICIOUS => 'fw-badge-red',
                ClassificationFlag::SUSPICIOUS => 'fw-badge-amber',
                ClassificationFlag::NORMAL => 'fw-badge-green',
                default => 'fw-badge-gray',
            };
        }

        /**
         * Returns a Bootstrap icon class for a MIME type.
         *
         * @param string|null $mime The MIME type to classify.
         * @return string The icon CSS class.
         */
        public static function getMimeIcon(?string $mime): string
        {
            $mime = $mime ?? '';
            return match(true)
            {
                str_contains($mime, 'pdf') => 'bi-filetype-pdf',
                str_contains($mime, 'image/') => 'bi-file-earmark-image',
                str_contains($mime, 'video/') => 'bi-file-earmark-play',
                str_contains($mime, 'audio/') => 'bi-file-earmark-music',
                str_contains($mime, 'text/') => 'bi-filetype-txt',
                str_contains($mime, 'zip') || str_contains($mime, 'rar') || str_contains($mime, 'tar') || str_contains($mime, 'gzip') => 'bi-file-earmark-zip',
                str_contains($mime, 'json') => 'bi-filetype-json',
                str_contains($mime, 'xml') => 'bi-filetype-xml',
                str_contains($mime, 'html') => 'bi-filetype-html',
                str_contains($mime, 'javascript') => 'bi-filetype-js',
                default => 'bi-file-earmark',
            };
        }

        /**
         * Send a JSON response and end the web session.
         *
         * @param array $data Response payload to encode as JSON.
         */
        public static function respondWithJson(array $data): never
        {
            WebSession::respondJson($data);
        }

        /**
         * Redirect to a named route and end the web session.
         *
         * <p>The success, error and error_message parameters are flashed into the cookie session instead of
         * being added to the address, see {@see Utilities::getRedirectStatus()}.
         *
         * @param string $route Name of the route to redirect to.
         * @param array $pathVariables Values for the route path variables.
         * @param array $queryParameters Query parameters to append to the route.
         */
        public static function redirect(string $route, array $pathVariables=[], array $queryParameters=[]): never
        {
            foreach(self::STATUS_PARAMETERS as $key)
            {
                if(isset($queryParameters[$key]) && WebSession::flash($key, (string)$queryParameters[$key]))
                {
                    unset($queryParameters[$key]);
                }
            }

            WebSession::redirectToRoute($route, $pathVariables, $queryParameters);
        }

        /**
         * Send a file download response and end the web session.
         *
         * @param string $filePath Path to the file to download.
         * @param string $filename Filename presented to the client.
         * @param string|null $mimeType MIME type to set for the response, when provided.
         */
        public static function respondWithDownload(string $filePath, string $filename, ?string $mimeType=null): void
        {
            $response = WebSession::getResponse()->setFileDownload($filePath, $filename);
            if($mimeType !== null)
            {
                $response->setHeader('Content-Type', $mimeType);
            }

            register_shutdown_function(static fn() => @unlink($filePath));
            WebSession::endSession(0);
        }

        /**
         * Resolves operator names for table and card labels.
         *
         * <p>When more than one operator is not yet known, the operator list is loaded once instead of
         * each operator separately; see {@see CachingFederationClient}. Operators the list does not
         * cover are still looked up one at a time.
         *
         * @param FederationClient $client The client to query.
         * @param array<string|null> $uuids The operator UUIDs; empty values and repeats are ignored.
         * @return array<string, string|null> Operator names keyed by UUID, or null where unavailable or not permitted.
         */
        public static function getOperatorNames(FederationClient $client, array $uuids): array
        {
            $uuids = array_values(array_unique(array_filter($uuids, static fn($uuid): bool => $uuid !== null && $uuid !== '')));
            if(!ViewAuthorization::canReadOperatorRecords())
            {
                return array_fill_keys($uuids, null);
            }

            if($client instanceof CachingFederationClient && count(array_filter($uuids, static fn(string $uuid): bool => !$client->hasOperator($uuid))) > 1)
            {
                try
                {
                    $client->listOperators();
                }
                catch(\Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load the operator list for labels', $exception);
                }
            }

            $names = [];
            foreach($uuids as $uuid)
            {
                try
                {
                    $names[$uuid] = $client->getOperator($uuid)->getName();
                }
                catch(\Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load operator label', $exception);
                    $names[$uuid] = null;
                }
            }

            return $names;
        }

        /**
         * Resolves entity addresses for table and card labels.
         *
         * @param FederationClient $client The client to query.
         * @param array<string|null> $uuids The entity UUIDs; empty values and repeats are ignored.
         * @return array<string, string|null> Entity addresses keyed by UUID, or null where unavailable.
         */
        public static function getEntityAddresses(FederationClient $client, array $uuids): array
        {
            $addresses = [];
            foreach(array_unique(array_filter($uuids, static fn($uuid): bool => $uuid !== null && $uuid !== '')) as $uuid)
            {
                try
                {
                    $addresses[$uuid] = $client->getEntityRecord($uuid)->getAddress();
                }
                catch(\Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load entity label', $exception);
                    $addresses[$uuid] = null;
                }
            }

            return $addresses;
        }

        /**
         * Fetches a report, with the empty strings the server's record cache substitutes for null
         * turned back into null.
         *
         * <p>The server caches single records in Redis hashes, which store null as an empty string,
         * so a cached unassigned report comes back with an assigned operator of '' rather than null.
         *
         * @param FederationClient $client The client to query.
         * @param string $reportUuid The report UUID.
         * @return ReportRecord The report.
         */
        public static function getReport(FederationClient $client, string $reportUuid): ReportRecord
        {
            return self::withoutCacheBlanks($client->getReport($reportUuid), ['reporting_entity', 'assigned_operator', 'message']);
        }

        /**
         * Fetches an evidence record with its metadata and without cache-substituted empty strings.
         * See {@see Utilities::getReport()} and {@see Utilities::withEvidenceMetadata()}.
         *
         * @param FederationClient $client The client to query.
         * @param string $evidenceUuid The evidence UUID.
         * @return EvidenceRecord The evidence record.
         */
        public static function getEvidence(FederationClient $client, string $evidenceUuid): EvidenceRecord
        {
            $evidence = self::withoutCacheBlanks($client->getEvidenceRecord($evidenceUuid), ['text_content', 'note', 'tag', 'report', 'classification_flag']);
            return self::withEvidenceMetadata($client, $evidence);
        }

        /**
         * Rebuilds a record with the given nullable fields set to null where they are empty strings.
         *
         * @template T of ReportRecord|EvidenceRecord
         * @param T $record The record.
         * @param string[] $nullableKeys The toArray() keys that are null when empty.
         * @return T The normalized record.
         */
        private static function withoutCacheBlanks(ReportRecord|EvidenceRecord $record, array $nullableKeys): ReportRecord|EvidenceRecord
        {
            $data = $record->toArray();
            $changed = false;
            foreach($nullableKeys as $key)
            {
                if(array_key_exists($key, $data) && $data[$key] === '')
                {
                    $data[$key] = null;
                    $changed = true;
                }
            }
            return $changed ? $record::fromArray($data) : $record;
        }

        /**
         * The most pages a view reads when it needs a whole filtered result set to count and
         * paginate it itself. Without a ceiling, one list view on a large server would download the
         * entire table; past this many pages the results shown are the first ones only.
         */
        public const int MAX_FETCH_PAGES = 50;

        /** Pages of 100 audit entries read per source before giving up. */
        private const int AUDIT_LOG_LOOKUP_PAGES = 5;

        /**
         * Collects the audit entries that concern one record, newest first.
         *
         * <p>Reading the most recent entries of the whole audit log and filtering them only finds the
         * history of records touched recently: on a busy server an older record shows none. Each
         * source is instead a scoped listing (an entity's or an operator's audit log) read page by
         * page, so the search follows the record rather than the server's overall activity.
         *
         * @param array<callable(int): array> $sources Page fetchers, each taking a 1-based page number.
         * @param callable(mixed): bool $filter Whether an entry concerns the record.
         * @return array|null The matching entries, or null when every source failed to load.
         */
        public static function collectAuditLogs(array $sources, callable $filter): ?array
        {
            $entries = [];
            $failures = 0;
            foreach($sources as $source)
            {
                try
                {
                    for($page = 1; $page <= self::AUDIT_LOG_LOOKUP_PAGES; $page++)
                    {
                        $logs = $source($page);
                        foreach($logs as $log)
                        {
                            if($filter($log))
                            {
                                $entries[$log->getUuid()] = $log;
                            }
                        }
                        if(count($logs) < 100)
                        {
                            break;
                        }
                    }
                }
                catch(\Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load audit logs', $exception);
                    $failures++;
                }
            }

            if($failures > 0 && $failures === count($sources))
            {
                return null;
            }

            $entries = array_values($entries);
            usort($entries, static fn($a, $b): int => $b->getTimestamp() <=> $a->getTimestamp());
            return $entries;
        }

        /** Pages of 100 records searched for a copy of an evidence record before giving up. */
        private const int EVIDENCE_METADATA_LOOKUP_PAGES = 5;

        /**
         * Returns the evidence record with its metadata, working around the server's record cache.
         *
         * <p>The server caches single evidence records in a Redis hash, which cannot hold the nested
         * metadata array: it is stored as the string "Array", so once a record is cached,
         * {@see FederationClient::getEvidenceRecord()} returns it with its metadata missing. The list
         * endpoints read the database (or a JSON-encoded result cache) and are unaffected, so when the
         * metadata is missing the same record is looked up there instead — first among its report's
         * evidence, which is small, then among its entity's.
         *
         * @param FederationClient $client The client to query.
         * @param EvidenceRecord $evidence The record as returned by getEvidenceRecord().
         * @return EvidenceRecord The record with its metadata, or the given record when no copy
         *         carrying metadata was found (including when it genuinely has none).
         */
        public static function withEvidenceMetadata(FederationClient $client, EvidenceRecord $evidence): EvidenceRecord
        {
            if(!empty($evidence->getMetadata()))
            {
                return $evidence;
            }

            // A confidential record is only listed with confidential records included, which the
            // server allows only to managers; anyone who could read this record is one.
            $includeConfidential = $evidence->isConfidential();
            $sources = [];
            $reportUuid = $evidence->getReport();
            if($reportUuid !== null && $reportUuid !== '')
            {
                $sources[] = fn(int $page): array => $client->listReportEvidenceRecords($reportUuid, $page, 100, $includeConfidential);
            }
            if($evidence->getEntityUuid() !== '')
            {
                $sources[] = fn(int $page): array => $client->listEntityEvidenceRecords($evidence->getEntityUuid(), $page, 100, $includeConfidential);
            }

            foreach($sources as $source)
            {
                for($page = 1; $page <= self::EVIDENCE_METADATA_LOOKUP_PAGES; $page++)
                {
                    try
                    {
                        $records = $source($page);
                    }
                    catch(\Exception $exception)
                    {
                        Logger::getLogger()->warning('Unable to look up evidence metadata', $exception);
                        break;
                    }

                    foreach($records as $record)
                    {
                        if($record->getUuid() === $evidence->getUuid())
                        {
                            return empty($record->getMetadata()) ? $evidence : $record;
                        }
                    }

                    if(count($records) < 100)
                    {
                        break;
                    }
                }
            }

            return $evidence;
        }
    }
