<?php

    namespace WebKernel;

    use DynamicalWeb\Enums\RequestMethod;
    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use FederationLib\FederationClient;
    use FederationLib\Enums\AuditLogType;
    use FederationLib\Objects\ServerInformation;

    /**
     * Provides data and search suggestions for the audit-log list view.
     */
    class AuditLogView
    {
        private bool $darkMode;
        private int $page;
        private int $limit;
        private ?string $searchQuery;
        private ?string $categoryFilter;
        private ?string $sortBy;
        private ?string $operatorId;
        private ?string $entityId;
        private ?string $apiOrder;
        private ?array $records;
        private int $totalRecords;
        private int $totalPages;
        /** @var array<string, string|null> Entity addresses keyed by UUID. */
        private array $entityAddresses;
        /** @var array<string, string|null> Operator names keyed by UUID. */
        private array $operatorNames;
        /** @var array<string, int|string> Active non-null query parameters. */
        private array $baseQuery;


        private bool $allRecords;
        private FederationClient $federationClient;
        private ServerInformation $serverInformation;

        /**
         * AuditLogView constructor.
         *
         * @param bool $allRecords Whether to load every matching record on one page instead of the requested
         *                         page, as the printable list does.
         */
        public function __construct(bool $allRecords=false)
        {
            $this->allRecords = $allRecords;
            $this->federationClient = WebSession::get('federation_client');
            $this->serverInformation = WebSession::get('server_information');
            $this->limit = 1;

            $queryParameters = WebSession::getRequest()->getQueryParameters();
            $page = max(1, (int)($queryParameters['page'] ?? 1));
            $searchQuery = $queryParameters['search_query'] ?? null;
            $categoryFilter = $queryParameters['category_filter'] ?? null;
            $sortBy = $queryParameters['sort_by'] ?? null;
            $sortOrder = $queryParameters['sort_order'] ?? null;
            $operatorId = $queryParameters['operator_id'] ?? null;
            $entityId = $queryParameters['entity_id'] ?? null;
            $hasSearch = $searchQuery !== null && $searchQuery !== '';
            $hasCategoryFilter = $categoryFilter !== null && $categoryFilter !== '';
            $apiCategory = match ($categoryFilter)
            {
                'operator_events' => 'OPERATOR_EVENTS',
                'attachment_events' => 'ATTACHMENT_EVENTS',
                'evidence_events' => 'EVIDENCE_EVENTS',
                'report_events' => 'REPORT_EVENTS',
                'entity_events' => 'ENTITY_EVENTS',
                'blacklist_events' => 'BLACKLIST_EVENTS',
                'other' => 'OTHER',
                default => null,
            };
            $apiOrder = match (strtoupper($sortOrder ?? ''))
            {
                'ASC' => 'ASC',
                'DESC' => 'DESC',
                default => null,
            };

            try
            {
                if($operatorId !== null)
                {
                    $all = $this->fetchAllPages(fn(int $page): array => $this->federationClient->listOperatorAuditLogs($operatorId, page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder));
                    $all = $this->filterRecords($all, $searchQuery, $hasSearch);
                    [$page, $records, $totalRecords, $totalPages] = $this->paginate($all, $page, true);
                }
                elseif($entityId !== null)
                {
                    $all = $this->fetchAllPages(fn(int $page): array => $this->federationClient->listEntityAuditLogs($entityId, page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder));
                    $all = $this->filterRecords($all, $searchQuery, $hasSearch);
                    [$page, $records, $totalRecords, $totalPages] = $this->paginate($all, $page, true);
                }
                elseif($hasSearch || $hasCategoryFilter || $allRecords)
                {
                    $all = $hasSearch && strlen($searchQuery) >= 2
                        ? $this->fetchAllPages(fn(int $page): array => $this->federationClient->searchAuditLogs($searchQuery, page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder))
                        : $this->fetchAllPages(fn(int $page): array => $this->federationClient->listAuditLogs(page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder));
                    [$page, $records, $totalRecords, $totalPages] = $this->paginate($all, $page);
                }
                else
                {
                    $firstPage = $this->federationClient->listAuditLogs(page: 1, by: $sortBy, order: $apiOrder);
                    $this->limit = max(1, count($firstPage));
                    $totalRecords = $this->serverInformation->getAuditLogRecords();
                    $totalPages = max(1, (int)ceil($totalRecords / $this->limit));
                    $page = min($page, $totalPages);
                    $records = $page === 1 ? $firstPage : $this->federationClient->listAuditLogs(page: $page, by: $sortBy, order: $apiOrder);
                }
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load audit logs', $exception);
                $records = null;
                $totalRecords = 0;
                $totalPages = 1;
            }

            [$entityAddresses, $operatorNames] = $this->loadRecordLabels($records);

            $this->darkMode = Utilities::getDarkMode();
            $this->page = $page;
            $this->searchQuery = $searchQuery;
            $this->categoryFilter = $categoryFilter;
            $this->sortBy = $sortBy;
            $this->operatorId = $operatorId;
            $this->entityId = $entityId;
            $this->apiOrder = $apiOrder;
            $this->records = $records;
            $this->totalRecords = $totalRecords;
            $this->totalPages = $totalPages;
            $this->entityAddresses = $entityAddresses;
            $this->operatorNames = $operatorNames;
            $this->baseQuery = array_filter([
                'operator_id' => $operatorId,
                'entity_id' => $entityId,
                'search_query' => $searchQuery,
                'category_filter' => $categoryFilter,
                'sort_by' => $sortBy,
                'sort_order' => $sortOrder,
            ]);
        }

        /**
         * Returns whether dark mode is enabled.
         *
         * @return bool Whether dark mode is enabled.
         */
        public function isDarkMode(): bool { return $this->darkMode; }
        /**
         * Returns the current result page.
         *
         * @return int The current page number.
         */
        public function getPage(): int { return $this->page; }
        /**
         * Returns the maximum number of records per page.
         *
         * @return int The page size.
         */
        public function getLimit(): int { return $this->limit; }
        /**
         * Returns the active audit-log search query.
         *
         * @return string|null The query, or null when no search is active.
         */
        public function getSearchQuery(): ?string { return $this->searchQuery; }
        /**
         * Returns the active audit-log category filter.
         *
         * @return string|null The filter, or null when none is active.
         */
        public function getCategoryFilter(): ?string { return $this->categoryFilter; }
        /**
         * Returns the active audit-log sort field.
         *
         * @return string|null The sort field, or null when unsorted.
         */
        public function getSortBy(): ?string { return $this->sortBy; }
        /**
         * Returns the operator filter UUID.
         *
         * @return string|null The operator UUID, or null when unfiltered.
         */
        public function getOperatorId(): ?string { return $this->operatorId; }
        /**
         * Returns the entity filter UUID.
         *
         * @return string|null The entity UUID, or null when unfiltered.
         */
        public function getEntityId(): ?string { return $this->entityId; }
        /**
         * Returns the normalized API sort order.
         *
         * @return string|null The API sort order, or null when unspecified.
         */
        public function getApiOrder(): ?string { return $this->apiOrder; }
        /**
         * Returns the audit-log records for the current page.
         *
         * @return array|null The records, or null when loading failed.
         */
        public function getRecords(): ?array { return $this->records; }
        /**
         * Returns the total number of matching audit-log records.
         *
         * @return int The total record count.
         */
        public function getTotalRecords(): int { return $this->totalRecords; }
        /**
         * Returns the total number of result pages.
         *
         * @return int The total page count.
         */
        public function getTotalPages(): int { return $this->totalPages; }
        /**
         * Returns entity UUID-to-address labels for the current records.
         *
         * @return array The entity address labels.
         */
        public function getEntityAddresses(): array { return $this->entityAddresses; }
        /**
         * Returns operator UUID-to-name labels for the current records.
         *
         * @return array The operator name labels.
         */
        public function getOperatorNames(): array { return $this->operatorNames; }
        /**
         * Returns query parameters that preserve the current view state.
         *
         * @return array The active query parameters.
         */
        public function getBaseQuery(): array { return $this->baseQuery; }
        /**
         * Formats a timestamp for display.
         *
         * @param int $timestamp The Unix timestamp to format.
         * @param string $format The date format string.
         * @return string The formatted date.
         */
        public function formatDate(int $timestamp, string $format='Y-m-d H:i'): string { return Utilities::formatDate($timestamp, $format); }
        /**
         * Returns the CSS badge color for an audit-log type.
         *
         * @param AuditLogType $type The audit-log type to classify.
         * @return string The CSS badge color class.
         */
        public function getTypeBadgeColor(AuditLogType $type): string { return self::resolveTypeBadgeColor($type); }

        /**
         * Processes audit-log search-suggestion requests.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest();
            if($request->getParameter('action') === 'search_suggestions')
            {
                Utilities::respondWithJson($this->searchSuggestions(trim((string)$request->getParameter('q'))));
            }
        }

        /**
         * Builds audit-log search suggestions.
         *
         * @param string $query The search text.
         * @return array The suggestion response payload.
         */
        private function searchSuggestions(string $query): array
        {
            if(strlen($query) < 2)
            {
                return ['results' => []];
            }

            try
            {
                $items = [];
                foreach($this->federationClient->searchAuditLogs($query, 1, 5) as $auditLog)
                {
                    $message = $auditLog->getMessage();
                    $items[] = [
                        'uuid' => $auditLog->getUuid(),
                        'title' => $message ? substr($message, 0, 60) . (strlen($message) > 60 ? '…' : '') : 'Audit Log Entry',
                        'subtitle' => str_replace('_', ' ', $auditLog->getType()->name),
                        'url' => Functions::getRouteUrl('audit_log_detail', pathVariables: ['audit_log_uuid' => $auditLog->getUuid()]),
                    ];
                }

                return ['results' => $items];
            }
            catch(\Throwable $exception)
            {
                Logger::getLogger()->warning('Unable to load audit log suggestions', $exception);
                return ['results' => []];
            }
        }

        /**
         * Filters records by the active search query.
         *
         * @param array $records The records to filter.
         * @param string|null $searchQuery The search text.
         * @param bool $hasSearch Whether a search was requested.
         * @return array The matching records.
         */
        private function filterRecords(array $records, ?string $searchQuery, bool $hasSearch): array
        {
            if(!$hasSearch || strlen($searchQuery) < 2)
            {
                return $records;
            }

            $searchLower = strtolower($searchQuery);
            return array_filter($records, static function($auditLog) use ($searchLower)
            {
                return str_contains(strtolower($auditLog->getMessage() ?? ''), $searchLower)
                    || str_contains(strtolower($auditLog->getType()->name ?? ''), $searchLower);
            });
        }

        /**
         * Paginates audit-log records.
         *
         * @param array $records The records to paginate.
         * @param int $page The requested page number.
         * @param bool $reindex Whether to reindex records before slicing.
         * @return array The page, records, total count, and page count.
         */
        private function paginate(array $records, int $page, bool $reindex=false): array
        {
            $totalRecords = count($records);
            $totalPages = max(1, (int)ceil($totalRecords / $this->limit));
            $page = min($page, $totalPages);
            $records = $reindex ? array_values($records) : $records;

            return [$page, array_slice($records, ($page - 1) * $this->limit, $this->limit), $totalRecords, $totalPages];
        }


        /**
         * Loads every default-size page so client-side filters can calculate complete totals.
         *
         * @param callable(int): array $fetchPage
         * @return array
         */
        private function fetchAllPages(callable $fetchPage): array
        {
            $records = $fetchPage(1);
            $this->limit = max(1, count($records));

            if(empty($records))
            {
                return [];
            }

            for($page = 2; $page <= Utilities::MAX_FETCH_PAGES; $page++)
            {
                $nextPage = $fetchPage($page);
                if(empty($nextPage))
                {
                    break;
                }

                array_push($records, ...$nextPage);
                if(count($nextPage) < $this->limit)
                {
                    break;
                }
            }

            if($this->allRecords)
            {
                // Everything is shown on one page, and a list filtered after loading still fits.
                $this->limit = max(1, count($records));
            }

            return $records;
        }
        /**
         * Loads display labels for entities and operators in records.
         *
         * @param array|null $records The records whose labels are required.
         * @return array Entity-address and operator-name label maps.
         */
        private function loadRecordLabels(?array $records): array
        {
            return [
                Utilities::getEntityAddresses($this->federationClient, array_map(static fn($auditLog) => $auditLog->getEntityUuid(), $records ?? [])),
                Utilities::getOperatorNames($this->federationClient, array_map(static fn($auditLog) => $auditLog->getOperatorUuid(), $records ?? [])),
            ];
        }

        /**
         * Resolves an audit-log type to its CSS badge color.
         *
         * @param AuditLogType $type The audit-log type to classify.
         * @return string The CSS badge color class.
         */
        private static function resolveTypeBadgeColor(AuditLogType $type): string
        {
            return match ($type->getCategory()->name)
            {
                'OPERATOR_EVENTS' => 'fw-badge-blue',
                'ATTACHMENT_EVENTS' => 'fw-badge-purple',
                'EVIDENCE_EVENTS' => 'fw-badge-amber',
                'REPORT_EVENTS' => 'fw-badge-gray',
                'ENTITY_EVENTS' => 'fw-badge-blue',
                'BLACKLIST_EVENTS' => 'fw-badge-red',
                default => 'fw-badge-gray',
            };
        }
    }
