<?php

    namespace WebKernel;

    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use FederationLib\Enums\IncidentType;
    use FederationLib\FederationClient;
    use FederationLib\Objects\ServerInformation;

    /**
     * Provides data and actions for the blacklist records list view.
     */
    class BlacklistView
    {
        private int $limit;
        private bool $darkMode;
        private int $page;
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
        /** @var array<string, array{label: string, opened: bool}|null> Report display details keyed by UUID. */
        private array $reportInfo;
        /** @var array<string, int|string> Active non-null query parameters. */
        private array $baseQuery;
        private ?string $successMessage;
        private ?string $errorMessage;
        private ?string $errorDetail;


        private bool $allRecords;
        private FederationClient $federationClient;
        private ServerInformation $serverInformation;

        /**
         * BlacklistView constructor.
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

            $query = WebSession::getRequest()->getQueryParameters();
            $page = WebSession::getRequest()->getIntParameter('page', 1, min: 1);
            $searchQuery = $query['search_query'] ?? null;
            $categoryFilter = $query['category_filter'] ?? null;
            $sortBy = $query['sort_by'] ?? null;
            $sortOrder = $query['sort_order'] ?? null;
            $operatorId = $query['operator_id'] ?? null;
            $entityId = $query['entity_id'] ?? null;
            $hasSearch = $searchQuery !== null && $searchQuery !== '';
            $hasCategoryFilter = $categoryFilter !== null && $categoryFilter !== '';
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
                    $all = $this->fetchAllPages(fn(int $page): array => $this->federationClient->listOperatorBlacklist($operatorId, page: $page, includeLifted: true, by: $sortBy, order: $apiOrder));
                    [$page, $totalRecords, $totalPages, $records] = $this->paginate($all, $page);
                }
                elseif($entityId !== null)
                {
                    $all = $this->fetchAllPages(fn(int $page): array => $this->federationClient->listEntityBlacklistRecords($entityId, page: $page, includeLifted: true, by: $sortBy, order: $apiOrder));
                    [$page, $totalRecords, $totalPages, $records] = $this->paginate($all, $page);
                }
                elseif($hasSearch || $hasCategoryFilter || $allRecords)
                {
                    $all = $hasSearch && strlen($searchQuery) >= 2
                        ? $this->fetchAllPages(fn(int $page): array => $this->federationClient->searchBlacklist($searchQuery, page: $page, category: $categoryFilter, by: $sortBy, order: $apiOrder))
                        : $this->fetchAllPages(fn(int $page): array => $this->federationClient->listBlacklistRecords(page: $page, includeLifted: true, category: $categoryFilter, by: $sortBy, order: $apiOrder));
                    [$page, $totalRecords, $totalPages, $records] = $this->paginate($all, $page, false);
                }
                else
                {
                    $firstPage = $this->federationClient->listBlacklistRecords(page: 1, includeLifted: true, by: $sortBy, order: $apiOrder);
                    $this->limit = max(1, count($firstPage));
                    $totalRecords = $this->serverInformation->getBlacklistRecords();
                    $totalPages = max(1, (int)ceil($totalRecords / $this->limit));
                    $page = min($page, $totalPages);
                    $records = $page === 1 ? $firstPage : $this->federationClient->listBlacklistRecords(page: $page, includeLifted: true, by: $sortBy, order: $apiOrder);
                }
            }
            catch(\Exception $e)
            {
                Logger::getLogger()->warning('Unable to load blacklist records', $e);
                $records = null;
                $totalRecords = 0;
                $totalPages = 1;
            }

            [$entityAddresses, $operatorNames, $reportInfo] = $this->loadRecordLabels($records);
            $statusMessages = Utilities::getStatusMessages();
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
            $this->reportInfo = $reportInfo;
            $this->baseQuery = array_filter([
                'operator_id' => $operatorId,
                'entity_id' => $entityId,
                'search_query' => $searchQuery,
                'category_filter' => $categoryFilter,
                'sort_by' => $sortBy,
                'sort_order' => $sortOrder,
            ]);
            $this->successMessage = $statusMessages->successMessageKey;
            $this->errorMessage = $statusMessages->errorMessageKey;
            $this->errorDetail = $statusMessages->errorDetail;
        }

        /**
         * Returns whether dark mode is enabled.
         *
         * @return bool Whether dark mode is enabled.
         */
        public function isDarkMode(): bool { return $this->darkMode; }
        /**
         * Returns the current success message key.
         *
         * @return string|null The success message key, or null when absent.
         */
        public function getSuccessMessage(): ?string { return $this->successMessage; }
        /**
         * Returns the current error message key.
         *
         * @return string|null The error message key, or null when absent.
         */
        public function getErrorMessage(): ?string { return $this->errorMessage; }
        /**
         * Returns the current error message detail.
         *
         * @return string|null The error detail, or null when absent.
         */
        public function getErrorDetail(): ?string { return $this->errorDetail; }
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
        public function getPageSize(): int { return $this->limit; }
        /**
         * Returns the active blacklist search query.
         *
         * @return string|null The query, or null when no search is active.
         */
        public function getSearchQuery(): ?string { return $this->searchQuery; }
        /**
         * Returns the active blacklist category filter.
         *
         * @return string|null The filter, or null when none is active.
         */
        public function getCategoryFilter(): ?string { return $this->categoryFilter; }
        /**
         * Returns the active blacklist sort field.
         *
         * @return string|null The sort field, or null when unsorted.
         */
        public function getSortBy(): ?string { return $this->sortBy; }
        /**
         * Returns the normalized API sort order.
         *
         * @return string|null The API sort order, or null when unspecified.
         */
        public function getApiOrder(): ?string { return $this->apiOrder; }
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
         * Returns the blacklist records for the current page.
         *
         * @return array|null The records, or null when loading failed.
         */
        public function getRecords(): ?array { return $this->records; }
        /**
         * Returns the total number of matching blacklist records.
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
         * Returns query parameters that preserve the current view state.
         *
         * @return array The active query parameters.
         */
        public function getBaseQuery(): array { return $this->baseQuery; }
        /**
         * Returns an operator name by UUID.
         *
         * @param string $uuid The operator UUID.
         * @return string|null The operator name, or null when unavailable.
         */
        public function getOperatorName(string $uuid): ?string { return $this->operatorNames[$uuid] ?? null; }
        /**
         * Returns an entity address by UUID.
         *
         * @param string $uuid The entity UUID.
         * @return string|null The entity address, or null when unavailable.
         */
        public function getEntityAddress(string $uuid): ?string { return $this->entityAddresses[$uuid] ?? null; }
        /**
         * Returns report display information by UUID.
         *
         * @param string $uuid The report UUID.
         * @return array|null The report display data, or null when unavailable.
         */
        public function getReportInfo(string $uuid): ?array { return $this->reportInfo[$uuid] ?? null; }
        /**
         * Returns the badge CSS class for a blacklist incident type.
         *
         * @param IncidentType $type The incident type.
         * @return string The badge CSS class.
         */
        public function getTypeBadge(IncidentType $type): string
        {
            return match($type->value)
            {
                'SPAM', 'SCAM' => 'fw-badge-amber',
                'MALWARE', 'ILLEGAL_CONTENT' => 'fw-badge-red',
                'PHISHING' => 'fw-badge-blue',
                'SERVICE_ABUSE' => 'fw-badge-purple',
                default => 'fw-badge-gray',
            };
        }
        /**
         * Formats a timestamp for display.
         *
         * @param int $timestamp The Unix timestamp to format.
         * @param string $format The date format string.
         * @return string The formatted date.
         */
        public function formatDate(int $timestamp, string $format='Y-m-d H:i'): string { return Utilities::formatDate($timestamp, $format); }

        /**
         * Processes blacklist actions and search-suggestion requests.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest();
            $action = $request->getParameter('action');
            if($action === 'search_suggestions')
            {
                Utilities::respondWithJson($this->searchSuggestions(trim((string)$request->getParameter('q'))));
            }

            $query = $request->getQueryParameters();
            $redirect = array_filter([
                'page' => $query['page'] ?? 1,
                'search_query' => $query['search_query'] ?? null,
                'category_filter' => $query['category_filter'] ?? null,
                'sort_by' => $query['sort_by'] ?? null,
                'sort_order' => $query['sort_order'] ?? null,
                'operator_id' => $query['operator_id'] ?? null,
                'entity_id' => $query['entity_id'] ?? null,
            ]);

            try
            {
                switch($action)
                {
                    case 'lift_blacklist':
                        $this->federationClient->liftBlacklistRecord($request->getParameter('blacklist_uuid'));
                        $redirect['success'] = 'blacklist_lifted';
                        break;
                    case 'delete_blacklist':
                        $this->federationClient->deleteBlacklistRecord($request->getParameter('blacklist_uuid'));
                        $redirect['success'] = 'blacklist_deleted';
                        break;
                }
            }
            catch(\Exception $e)
            {
                Logger::getLogger()->warning('Unable to process blacklist action', $e);
                $redirect['error'] = match ($action)
                {
                    'lift_blacklist' => 'blacklist_lift_failed',
                    'delete_blacklist' => 'blacklist_delete_failed',
                    default => $action . '_failed',
                };
                $redirect['error_message'] = $e->getMessage();
            }

            Utilities::redirect('blacklist', queryParameters: $redirect);
        }

        /**
         * Paginates blacklist records.
         *
         * @param array $records The records to paginate.
         * @param int $page The requested page number.
         * @param bool $preserveKeys Whether to reindex records before slicing.
         * @return array The page, total count, page count, and page records.
         */
        private function paginate(array $records, int $page, bool $preserveKeys=true): array
        {
            $totalRecords = count($records);
            $totalPages = max(1, (int)ceil($totalRecords / $this->limit));
            $page = min($page, $totalPages);
            $records = $preserveKeys ? array_values($records) : $records;

            return [$page, $totalRecords, $totalPages, array_slice($records, ($page - 1) * $this->limit, $this->limit)];
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
         * Loads display labels for records and their related evidence.
         *
         * @param array|null $records The records whose labels are required.
         * @return array Entity, operator, and evidence display maps.
         */
        private function loadRecordLabels(?array $records): array
        {
            $reportInfo = [];
            foreach($records ?? [] as $record)
            {
                $reportUuid = $record->getReportUuid();
                if($reportUuid === null || array_key_exists($reportUuid, $reportInfo))
                {
                    continue;
                }
                try
                {
                    $report = Utilities::getReport($this->federationClient, $reportUuid);
                    $reportInfo[$reportUuid] = [
                        'label' => ucwords(str_replace('_', ' ', $report->getIncidentType()->value)),
                        'opened' => $report->isOpened(),
                    ];
                }
                catch(\Exception $e)
                {
                    Logger::getLogger()->warning('Unable to load report label for blacklist record', $e);
                    $reportInfo[$reportUuid] = null;
                }
            }

            return [
                Utilities::getEntityAddresses($this->federationClient, array_map(static fn($record) => $record->getEntityUuid(), $records ?? [])),
                Utilities::getOperatorNames($this->federationClient, array_map(static fn($record) => $record->getOperatorUuid(), $records ?? [])),
                $reportInfo,
            ];
        }

        /**
         * Builds blacklist search suggestions.
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
                foreach($this->federationClient->searchBlacklist($query, 1, 5) as $record)
                {
                    $items[] = [
                        'uuid' => $record->getUuid(),
                        'title' => $record->getType()->name,
                        'subtitle' => $record->isLifted() ? 'Lifted' : 'Active',
                        'url' => Functions::getRouteUrl('blacklist_detail', pathVariables: ['blacklist_uuid' => $record->getUuid()]),
                    ];
                }

                return ['results' => $items];
            }
            catch(\Throwable $e)
            {
                Logger::getLogger()->warning('Unable to load blacklist search suggestions', $e);
                return ['results' => []];
            }
        }
    }
