<?php

    namespace WebKernel;

    use DynamicalWeb\Enums\RequestMethod;
    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use FederationLib\FederationClient;
    use FederationLib\Enums\Categories\AuditLogCategory;
    use FederationLib\Enums\AuditLogType;
    use FederationLib\Enums\ClassificationFlag;
    use FederationLib\Enums\IncidentType;
    use FederationLib\Enums\RecordType;
    use FederationLib\Objects\EntityRecord;

    /**
     * Provides global search results and search-dropdown suggestions.
     */
    class SearchView
    {
        private const int PAGE_SIZE = 15;
        private bool $darkMode;
        private string $query;
        private int $page;
        private int $limit;
        private ?string $error;
        private array $results;
        private int $totalCount;
        private array $operatorNames;
        private array $entityAddresses;
        private ?array $groupedResults;
        private ?FederationClient $federationClient;

        /**
         * SearchView constructor.
         */
        public function __construct()
        {
            $this->federationClient = WebSession::get('federation_client');

            $queryParameters = WebSession::getRequest()->getQueryParameters();
            $query = trim($queryParameters['q'] ?? '');
            $page = WebSession::getRequest()->getIntParameter('page', 1, min: 1);
            $error = null;
            $results = [];
            $totalCount = 0;

            if(strlen($query) > 0)
            {
                if(strlen($query) < 2)
                {
                    $error = $this->localize('error_short_query');
                }
                elseif($this->federationClient === null)
                {
                    $error = $this->localize('error_loading');
                }
                else
                {
                    try
                    {
                        $results = $this->federationClient->search($query, null, $page, self::PAGE_SIZE);
                        $totalCount = count($results);
                    }
                    catch(\Throwable $exception)
                    {
                        Logger::getLogger()->warning('Unable to search records', $exception);
                        $error = $this->localize('error_loading');
                    }
                }
            }

            $this->darkMode = Utilities::getDarkMode();
            $this->query = $query;
            $this->page = $page;
            $this->limit = self::PAGE_SIZE;
            $this->error = $error;
            $this->results = $results;
            $this->totalCount = $totalCount;
            $this->operatorNames = [];
            $this->entityAddresses = [];
            $this->groupedResults = null;
        }

        /**
         * Returns whether dark mode is enabled.
         *
         * @return bool Whether dark mode is enabled.
         */
        public function isDarkMode(): bool { return $this->darkMode; }
        /**
         * Returns the submitted search query.
         *
         * @return string The normalized search query.
         */
        public function getQuery(): string { return $this->query; }
        /**
         * Returns the current result page.
         *
         * @return int The current page number.
         */
        public function getPage(): int { return $this->page; }
        /**
         * Returns the maximum number of search results per page.
         *
         * @return int The page size.
         */
        public function getLimit(): int { return $this->limit; }
        /**
         * Returns the search error message.
         *
         * @return string|null The error message, or null when the search succeeded.
         */
        public function getError(): ?string { return $this->error; }
        /**
         * Returns the current search results.
         *
         * @return array The search result records.
         */
        public function getResults(): array { return $this->results; }
        /**
         * Returns the number of current search results.
         *
         * @return int The result count.
         */
        public function getTotalCount(): int { return $this->totalCount; }
        /**
         * Returns whether another page of results may exist.
         *
         * <p>The server applies the limit to each record type separately, so a page holds up to
         * that many results of every type. Only a type that filled its share can have more; the
         * combined count says nothing, since a few results from each of several types can exceed
         * the limit without any type having another page.
         *
         * @return bool Whether any record type returned a full page.
         */
        public function hasNextPage(): bool
        {
            foreach($this->getGroupedResults() as $records)
            {
                if(count($records) >= $this->limit)
                {
                    return true;
                }
            }
            return false;
        }
        /**
         * Translates a search locale key.
         *
         * @param string $key The locale string key.
         * @param array $parameters Values interpolated into the localized string.
         * @return string The localized string, or the key when unavailable.
         */
        public function localize(string $key, array $parameters=[]): string { return WebSession::getLocale()?->getString('search', $key, $parameters) ?? $key; }
        /**
         * Abbreviates a UUID for display.
         *
         * @param string $uuid The UUID to abbreviate.
         * @return string The abbreviated UUID.
         */
        public function shortUuid(string $uuid): string { return substr($uuid, 0, 8) . '…'; }
        /**
         * Formats an optional timestamp as a date.
         *
         * @param int|null $timestamp The Unix timestamp to format.
         * @return string The formatted date.
         */
        public function formatDate(?int $timestamp): string { return Utilities::formatDate($timestamp ?? 0, 'M j, Y'); }
        /**
         * Formats an optional timestamp as a date and time.
         *
         * @param int|null $timestamp The Unix timestamp to format.
         * @return string The formatted date and time.
         */
        public function formatDateTime(?int $timestamp): string { return Utilities::formatDate($timestamp ?? 0, 'M j, Y H:i'); }
        /**
         * Formats a byte count using a localized unit.
         *
         * @param int $bytes The byte count to format.
         * @return string The formatted file size.
         */
        public function formatFileSize(int $bytes): string
        {
            return $bytes >= 1048576
                ? round($bytes / 1048576, 1) . ' ' . $this->localize('file_size_mb')
                : ($bytes >= 1024
                    ? round($bytes / 1024, 1) . ' ' . $this->localize('file_size_kb')
                    : $bytes . ' ' . $this->localize('file_size_b'));
        }

        /**
         * Groups the current search results by record type, preserving result order.
         *
         * @return array<string, array> The records of every present record type, keyed by the record type value.
         */
        public function getGroupedResults(): array
        {
            if($this->groupedResults !== null)
            {
                return $this->groupedResults;
            }

            $grouped = [];
            foreach($this->results as $result)
            {
                $grouped[$result->getType()->value][] = $result->getRecord();
            }

            return $this->groupedResults = $grouped;
        }

        /**
         * Resolves an operator UUID to its current display name.
         *
         * @param string|null $uuid The operator UUID to resolve.
         * @return string|null The operator name, or null when it cannot be resolved.
         */
        public function getOperatorName(?string $uuid): ?string
        {
            if($uuid === null || $uuid === '')
            {
                return null;
            }

            if(array_key_exists($uuid, $this->operatorNames))
            {
                return $this->operatorNames[$uuid];
            }

            if (!ViewAuthorization::canReadOperatorRecords())
            {
                return $this->operatorNames[$uuid] = null;
            }

            try
            {
                return $this->operatorNames[$uuid] = $this->federationClient?->getOperator($uuid)->getName();
            }
            catch(\Throwable $exception)
            {
                Logger::getLogger()->warning('Unable to load search operator label', $exception);
                return $this->operatorNames[$uuid] = null;
            }
        }

        /**
         * Resolves an entity UUID to its current address.
         *
         * @param string|null $uuid The entity UUID to resolve.
         * @return string|null The entity address, or null when it cannot be resolved.
         */
        public function getEntityAddress(?string $uuid): ?string
        {
            if($uuid === null || $uuid === '')
            {
                return null;
            }

            if(array_key_exists($uuid, $this->entityAddresses))
            {
                return $this->entityAddresses[$uuid];
            }

            try
            {
                return $this->entityAddresses[$uuid] = $this->federationClient?->getEntityRecord($uuid)->getAddress();
            }
            catch(\Throwable $exception)
            {
                Logger::getLogger()->warning('Unable to load search entity label', $exception);
                return $this->entityAddresses[$uuid] = null;
            }
        }

        /**
         * Builds the detail-page URL of a search result record.
         *
         * @param RecordType $type The type of the record.
         * @param object $record The record to link to.
         * @return string The detail-page URL of the record.
         */
        public function getDetailUrl(RecordType $type, object $record): string
        {
            return match($type)
            {
                RecordType::ENTITY => Functions::getRouteUrl('entity_detail', pathVariables: ['entity_id' => $record->getUuid()]),
                RecordType::EVIDENCE => Functions::getRouteUrl('evidence_detail', pathVariables: ['evidence_uuid' => $record->getUuid()]),
                RecordType::REPORT => Functions::getRouteUrl('report_detail', pathVariables: ['report_uuid' => $record->getUuid()]),
                RecordType::BLACKLIST => Functions::getRouteUrl('blacklist_detail', pathVariables: ['blacklist_uuid' => $record->getUuid()]),
                RecordType::OPERATOR => Functions::getRouteUrl('operator_detail', pathVariables: ['operator_id' => $record->getUuid()]),
                RecordType::AUDIT_LOG => Functions::getRouteUrl('audit_log_detail', pathVariables: ['audit_log_uuid' => $record->getUuid()]),
                RecordType::ATTACHMENT => Functions::getRouteUrl('evidence_detail', pathVariables: ['evidence_uuid' => $record->getEvidenceUuid()]),
            };
        }

        /**
         * Returns the list route of a record type.
         *
         * @param RecordType $type The record type to resolve.
         * @return string|null The list route ID, or null when the record type has no list page.
         */
        public function getListRoute(RecordType $type): ?string
        {
            return match($type)
            {
                RecordType::ENTITY => 'entities',
                RecordType::EVIDENCE => 'evidence',
                RecordType::REPORT => 'reports',
                RecordType::BLACKLIST => 'blacklist',
                RecordType::OPERATOR => 'operators',
                RecordType::AUDIT_LOG => 'audit_log',
                RecordType::ATTACHMENT => null,
            };
        }

        /**
         * Returns the Bootstrap icon of a record type.
         *
         * @param RecordType $type The record type to classify.
         * @return string The Bootstrap icon class.
         */
        public function getTypeIcon(RecordType $type): string
        {
            return match($type)
            {
                RecordType::ENTITY => 'bi-person',
                RecordType::EVIDENCE => 'bi-file-earmark-text',
                RecordType::REPORT => 'bi-flag',
                RecordType::BLACKLIST => 'bi-shield-exclamation',
                RecordType::OPERATOR => 'bi-person-badge',
                RecordType::AUDIT_LOG => 'bi-journal-text',
                RecordType::ATTACHMENT => 'bi-paperclip',
            };
        }

        /**
         * Returns the icon color class of a record type.
         *
         * @param RecordType $type The record type to classify.
         * @return string The CSS icon color class.
         */
        public function getTypeIconColor(RecordType $type): string
        {
            return match($type)
            {
                RecordType::ENTITY => 'fw-icon-amber',
                RecordType::EVIDENCE => 'fw-icon-cyan',
                RecordType::REPORT => 'fw-icon-blue',
                RecordType::BLACKLIST => 'fw-icon-red',
                RecordType::OPERATOR => 'fw-icon-green',
                RecordType::AUDIT_LOG => 'fw-icon-purple',
                RecordType::ATTACHMENT => 'fw-icon-navy',
            };
        }

        /**
         * Returns the CSS badge color for an audit-log type.
         *
         * @param AuditLogType $type The audit-log type to classify.
         * @return string The badge color name.
         */
        public function getAuditLogBadgeColor(AuditLogType $type): string
        {
            return match($type)
            {
                AuditLogType::OPERATOR_DELETED,
                AuditLogType::ATTACHMENT_DELETED,
                AuditLogType::EVIDENCE_DELETED,
                AuditLogType::REPORT_DELETED,
                AuditLogType::ENTITY_DELETED,
                AuditLogType::BLACKLIST_DELETED,
                AuditLogType::OPERATOR_DISABLED => 'red',

                AuditLogType::ENTITY_BLACKLISTED => 'amber',

                default => match($type->getCategory())
                {
                    AuditLogCategory::OPERATOR_EVENTS,
                    AuditLogCategory::ENTITY_EVENTS => 'blue',
                    AuditLogCategory::ATTACHMENT_EVENTS => 'purple',
                    AuditLogCategory::EVIDENCE_EVENTS => 'amber',
                    AuditLogCategory::BLACKLIST_EVENTS => 'red',
                    default => 'gray',
                },
            };
        }

        /**
         * Returns the CSS badge class for an incident type.
         *
         * @param IncidentType $type The incident type to classify.
         * @return string The CSS badge class.
         */
        public function getIncidentBadge(IncidentType $type): string
        {
            return match($type)
            {
                IncidentType::MALWARE, IncidentType::ILLEGAL_CONTENT => 'fw-badge-red',
                IncidentType::PHISHING => 'fw-badge-blue',
                IncidentType::SCAM, IncidentType::SPAM => 'fw-badge-amber',
                IncidentType::SERVICE_ABUSE => 'fw-badge-purple',
                IncidentType::OTHER => 'fw-badge-gray',
            };
        }

        /**
         * Returns the CSS badge class for an evidence classification.
         *
         * @param ClassificationFlag|null $classification The classification to render.
         * @return string The CSS badge class.
         */
        public function getClassificationBadge(?ClassificationFlag $classification): string
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
         * Returns the CSS badge class for an entity reputation score.
         *
         * @param int $reputation The reputation score to classify.
         * @return string The CSS badge class.
         */
        public function getReputationBadge(int $reputation): string
        {
            return match(true)
            {
                $reputation <= -500 => 'fw-badge-red',
                $reputation < 0 => 'fw-badge-amber',
                $reputation === 0 => 'fw-badge-gray',
                default => 'fw-badge-green',
            };
        }

        /**
         * Processes search-dropdown requests.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest();
            if($request->getParameter('action') === 'search_dropdown')
            {
                Utilities::respondWithJson($this->searchDropdown(trim((string)$request->getParameter('q'))));
            }
        }

        /**
         * Builds global search-dropdown suggestions.
         *
         * @param string $query The search text.
         * @return array The suggestion response payload.
         */
        private function searchDropdown(string $query): array
        {
            if(strlen($query) < 2)
            {
                return ['results' => []];
            }

            try
            {
                $items = [];
                foreach($this->federationClient->search($query, null, 1, 5) as $result)
                {
                    $record = $result->getRecord();
                    $type = $result->getType();
                    [$url, $title, $description] = $this->getDropdownRecordDetails($type, $record);
                    $items[] = [
                        'type' => $type->value,
                        'value' => $record instanceof EntityRecord ? $record->getUuid() : '',
                        'url' => $url,
                        'title' => $title,
                        'desc' => $description,
                        'label' => $this->localize('result_' . strtolower($type->value)),
                    ];
                }

                return ['results' => $items];
            }
            catch(\Throwable $exception)
            {
                Logger::getLogger()->warning('Unable to load search dropdown', $exception);
                return ['results' => [], 'error' => $exception->getMessage()];
            }
        }

        /**
         * Resolves dropdown display details for a search record.
         *
         * @param RecordType $type The type of record to describe.
         * @param object $record The record to describe.
         * @return array The destination URL, title, and description.
         */
        private function getDropdownRecordDetails(RecordType $type, object $record): array
        {
            $uuidPrefix = static fn(string $uuid): string => substr($uuid, 0, 8) . '…';
            $formatDate = static fn(int $timestamp): string => Utilities::formatDate($timestamp, 'M j, Y');

            return match ($type)
            {
                RecordType::ENTITY => [
                    Functions::getRouteUrl('entity_detail', pathVariables: ['entity_id' => $record->getUuid()]),
                    $record->getAddress(),
                    $this->localize('classification_prefix') . $record->getReputation() . $this->localize('created_prefix') . $formatDate($record->getCreated()),
                ],
                RecordType::EVIDENCE => [
                    Functions::getRouteUrl('evidence_detail', pathVariables: ['evidence_uuid' => $record->getUuid()]),
                    $this->localize('evidence') . ' ' . $uuidPrefix($record->getUuid()),
                    $this->localize('entity_prefix') . $uuidPrefix($record->getEntityUuid()) . ($record->getTag() ? ' · ' . $this->localize('tag') . ': ' . $record->getTag() : '') . ' · ' . $formatDate($record->getCreated()),
                ],
                RecordType::REPORT => [
                    Functions::getRouteUrl('report_detail', pathVariables: ['report_uuid' => $record->getUuid()]),
                    ucwords(str_replace('_', ' ', $record->getIncidentType()->value)) . ($record->isOpened() ? ' (' . $this->localize('open') . ')' : ' (' . $this->localize('closed') . ')'),
                    ($record->getMessage() ? substr($record->getMessage(), 0, 80) . (strlen($record->getMessage()) > 80 ? '…' : '') : $this->localize('no_message')) . ' · ' . $formatDate($record->getCreated()),
                ],
                RecordType::BLACKLIST => [
                    Functions::getRouteUrl('blacklist_detail', pathVariables: ['blacklist_uuid' => $record->getUuid()]),
                    ucwords(str_replace('_', ' ', $record->getType()->value)) . ' ' . $this->localize('blacklist'),
                    $this->localize('entity_prefix') . $uuidPrefix($record->getEntityUuid()) . ' · ' . ($record->isLifted() ? $this->localize('status_lifted') : ($record->getExpires() ? $this->localize('expires') . ' ' . $formatDate($record->getExpires()) : $this->localize('permanent'))),
                ],
                RecordType::OPERATOR => [
                    Functions::getRouteUrl('operator_detail', pathVariables: ['operator_id' => $record->getUuid()]),
                    $record->getName(),
                    $uuidPrefix($record->getUuid()) . ' · ' . ($record->isDisabled() ? $this->localize('disabled') : $this->localize('active')) . $this->localize('created_prefix') . $formatDate($record->getCreated()),
                ],
                RecordType::AUDIT_LOG => [
                    Functions::getRouteUrl('audit_log_detail', pathVariables: ['audit_log_uuid' => $record->getUuid()]),
                    $record->getMessage() ? substr($record->getMessage(), 0, 60) . (strlen($record->getMessage()) > 60 ? '…' : '') : $this->localize('audit_log_entry'),
                    $uuidPrefix($record->getUuid()) . ' · ' . $formatDate($record->getTimestamp()),
                ],
                RecordType::ATTACHMENT => [
                    Functions::getRouteUrl('evidence_detail', pathVariables: ['evidence_uuid' => $record->getEvidenceUuid() ?? '']),
                    $record->getFileName() ?? $this->localize('unknown_file'),
                    $record->getFileMime() ?? $this->localize('unknown_type'),
                ],
            };
        }

    }
