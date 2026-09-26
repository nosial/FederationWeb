<?php

    namespace WebKernel;

    use DynamicalWeb\Enums\RequestMethod;
    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use FederationLib\Enums\ClassificationFlag;
    use FederationLib\Enums\IncidentType;
    use FederationLib\FederationClient;
    use FederationLib\Objects\ServerInformation;

    /**
     * Provides data and actions for the reports list view.
     */
    class ReportsView
    {
        private int $limit;
        private bool $darkMode;
        private int $page;
        private ?string $searchQuery;
        private ?string $categoryFilter;
        private ?string $sortBy;
        private ?string $operatorId;
        private ?string $entityId;
        private ?string $assignedOperatorId;
        private ?string $apiOrder;
        private ?array $reports;
        private int $totalReports;
        private int $totalPages;
        /** @var array<string, string|null> Operator names keyed by UUID. */
        private array $operatorNames;
        /** @var array<string, string|null> Entity addresses keyed by UUID. */
        private array $entityAddresses;
        /** @var array<string, int|string> Active non-null query parameters. */
        private array $baseQuery;
        private ?string $successMessage;
        private ?string $errorMessage;
        private ?string $errorDetail;


        private bool $allRecords;
        private FederationClient $federationClient;
        private ServerInformation $serverInformation;

        /**
         * ReportsView constructor.
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
            $page = max(1, (int)($query['page'] ?? 1));
            $searchQuery = $query['search_query'] ?? null;
            $categoryFilter = $query['category_filter'] ?? null;
            $sortBy = $query['sort_by'] ?? null;
            $sortOrder = $query['sort_order'] ?? null;
            $operatorId = $query['operator_id'] ?? null;
            $entityId = $query['entity_id'] ?? null;
            $assignedOperatorId = $query['assigned_operator_id'] ?? null;
            $hasSearch = $searchQuery !== null && $searchQuery !== '';
            $hasCategoryFilter = $categoryFilter !== null && $categoryFilter !== '';
            $apiCategory = match ($categoryFilter)
            {
                'opened' => 'OPENED',
                'closed' => 'CLOSED',
                'automated' => 'AUTOMATED',
                'unassigned' => 'UNASSIGNED',
                'assigned' => 'ASSIGNED',
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
                if($assignedOperatorId !== null)
                {
                    $all = $this->fetchAllPages(fn(int $page): array => $this->federationClient->listAssignedOperatorReports($assignedOperatorId, page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder));
                    $all = $this->filterReports($all, $searchQuery, $hasSearch);
                    [$page, $totalReports, $totalPages, $reports] = $this->paginate($all, $page);
                }
                elseif($operatorId !== null)
                {
                    $all = $this->fetchAllPages(fn(int $page): array => $this->federationClient->listOperatorReports($operatorId, page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder));
                    $all = $this->filterReports($all, $searchQuery, $hasSearch);
                    [$page, $totalReports, $totalPages, $reports] = $this->paginate($all, $page);
                }
                elseif($entityId !== null)
                {
                    $all = $this->fetchAllPages(fn(int $page): array => $this->federationClient->listEntityReports($entityId, page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder));
                    $all = $this->filterReports($all, $searchQuery, $hasSearch);
                    [$page, $totalReports, $totalPages, $reports] = $this->paginate($all, $page);
                }
                elseif($hasSearch || $hasCategoryFilter || $allRecords)
                {
                    $all = $hasSearch && strlen($searchQuery) >= 2
                        ? $this->fetchAllPages(fn(int $page): array => $this->federationClient->searchReports($searchQuery, page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder))
                        : $this->fetchAllPages(fn(int $page): array => $this->federationClient->listReports(page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder));
                    [$page, $totalReports, $totalPages, $reports] = $this->paginate($all, $page, false);
                }
                else
                {
                    $firstPage = $this->federationClient->listReports(page: 1, by: $sortBy, order: $apiOrder);
                    $this->limit = max(1, count($firstPage));
                    $totalReports = $this->serverInformation->getReports();
                    $totalPages = max(1, (int)ceil($totalReports / $this->limit));
                    $page = min($page, $totalPages);
                    $reports = $page === 1 ? $firstPage : $this->federationClient->listReports(page: $page, by: $sortBy, order: $apiOrder);
                }
            }
            catch(\Exception $e)
            {
                Logger::getLogger()->warning('Unable to load reports', $e);
                $reports = null;
                $totalReports = 0;
                $totalPages = 1;
            }

            [$operatorNames, $entityAddresses] = $this->loadRecordLabels($reports);
            $statusMessages = Utilities::getStatusMessages();
            $this->darkMode = Utilities::getDarkMode();
            $this->page = $page;
            $this->searchQuery = $searchQuery;
            $this->categoryFilter = $categoryFilter;
            $this->sortBy = $sortBy;
            $this->operatorId = $operatorId;
            $this->entityId = $entityId;
            $this->assignedOperatorId = $assignedOperatorId;
            $this->apiOrder = $apiOrder;
            $this->reports = $reports;
            $this->totalReports = $totalReports;
            $this->totalPages = $totalPages;
            $this->operatorNames = $operatorNames;
            $this->entityAddresses = $entityAddresses;
            $this->baseQuery = array_filter([
                'operator_id' => $operatorId,
                'entity_id' => $entityId,
                'assigned_operator_id' => $assignedOperatorId,
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
         * Returns the maximum number of reports per page.
         *
         * @return int The page size.
         */
        public function getPageSize(): int { return $this->limit; }
        /**
         * Returns the active report search query.
         *
         * @return string|null The query, or null when no search is active.
         */
        public function getSearchQuery(): ?string { return $this->searchQuery; }
        /**
         * Returns the active report category filter.
         *
         * @return string|null The filter, or null when none is active.
         */
        public function getCategoryFilter(): ?string { return $this->categoryFilter; }
        /**
         * Returns the active report sort field.
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
         * Returns the submitting operator filter UUID.
         *
         * @return string|null The operator UUID, or null when unfiltered.
         */
        public function getOperatorId(): ?string { return $this->operatorId; }
        /**
         * Returns the reporting entity filter UUID.
         *
         * @return string|null The entity UUID, or null when unfiltered.
         */
        public function getEntityId(): ?string { return $this->entityId; }
        /**
         * Returns the assigned operator filter UUID.
         *
         * @return string|null The operator UUID, or null when unfiltered.
         */
        public function getAssignedOperatorId(): ?string { return $this->assignedOperatorId; }
        /**
         * Returns the reports for the current page.
         *
         * @return array|null The reports, or null when loading failed.
         */
        public function getReports(): ?array { return $this->reports; }
        /**
         * Returns the total number of matching reports.
         *
         * @return int The total report count.
         */
        public function getTotalReports(): int { return $this->totalReports; }
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
         * Returns the badge CSS class for an incident type.
         *
         * @param IncidentType $incidentType The report incident type.
         * @return string The badge CSS class.
         */
        public function getIncidentBadge(IncidentType $incidentType): string
        {
            return match($incidentType)
            {
                IncidentType::MALWARE, IncidentType::ILLEGAL_CONTENT => 'fw-badge-red',
                IncidentType::PHISHING, IncidentType::SCAM => 'fw-badge-amber',
                IncidentType::SERVICE_ABUSE => 'fw-badge-purple',
                IncidentType::SPAM => 'fw-badge-gray',
                default => 'fw-badge-blue',
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
         * Processes report actions and search-suggestion requests.
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
                'assigned_operator_id' => $query['assigned_operator_id'] ?? null,
            ]);

            try
            {
                switch($action)
                {
                    case 'close_report':
                        $reportUuid = $request->getParameter('report_uuid');
                        $classification = $request->getParameter('classification');
                        $classificationFlag = empty($classification) ? null : ClassificationFlag::tryFrom($classification);
                        $this->assignCurrentOperatorBeforeClosing($reportUuid);
                        $this->federationClient->closeReport($reportUuid, $classificationFlag);
                        $redirect['success'] = 'report_closed';
                        break;
                    case 'delete_report':
                        $this->federationClient->deleteReport($request->getParameter('report_uuid'));
                        $redirect['success'] = 'report_deleted';
                        break;
                }
            }
            catch(\Exception $e)
            {
                Logger::getLogger()->warning('Unable to process report action', $e);
                $redirect['error'] = match ($action)
                {
                    'close_report' => 'report_close_failed',
                    'delete_report' => 'report_delete_failed',
                    default => $action . '_failed',
                };
                $redirect['error_message'] = $e->getMessage();
            }

            Utilities::redirect('reports', queryParameters: $redirect);
        }

        /**
         * Assigns the current operator before closing an open report.
         *
         * @param string|null $reportUuid The report UUID to prepare for closure.
         */
        private function assignCurrentOperatorBeforeClosing(?string $reportUuid): void
        {
            $operatorUuid = WebSession::getCookieSession('web_session')->get('operator_uuid', '');
            if(empty($operatorUuid))
            {
                try
                {
                    $operatorUuid = $this->federationClient->getSelf()->getUuid();
                }
                catch(\Exception $e)
                {
                    Logger::getLogger()->warning('Unable to determine current operator before closing report', $e);
                    return;
                }
            }

            if(empty($operatorUuid))
            {
                return;
            }

            try
            {
                $report = Utilities::getReport($this->federationClient, $reportUuid);
                if($report->isOpened() && $report->getAssignedOperator() !== $operatorUuid)
                {
                    $this->federationClient->assignOperatorToReport($reportUuid, $operatorUuid);
                }
            }
            catch(\Exception $e)
            {
                Logger::getLogger()->warning('Unable to assign current operator before closing report', $e);
            }
        }

        /**
         * Paginates report records.
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
         * Filters reports by the active search query.
         *
         * @param array $reports The reports to filter.
         * @param string|null $searchQuery The search text.
         * @param bool $hasSearch Whether a search was requested.
         * @return array The matching reports.
         */
        private function filterReports(array $reports, ?string $searchQuery, bool $hasSearch): array
        {
            if(!$hasSearch || strlen($searchQuery) < 2)
            {
                return $reports;
            }

            $searchLower = strtolower($searchQuery);
            return array_filter($reports, static function($report) use ($searchLower)
            {
                return str_contains(strtolower($report->getIncidentType()->value ?? ''), $searchLower)
                    || str_contains(strtolower($report->getUuid()), $searchLower);
            });
        }

        /**
         * Loads display labels for report operators and entities.
         *
         * @param array|null $reports The reports whose labels are required.
         * @return array Operator-name and entity-address label maps.
         */
        private function loadRecordLabels(?array $reports): array
        {
            $operatorUuids = [];
            foreach($reports ?? [] as $report)
            {
                $operatorUuids[] = $report->getSubmittingOperator();
                $operatorUuids[] = $report->getAssignedOperator();
            }

            return [
                Utilities::getOperatorNames($this->federationClient, $operatorUuids),
                Utilities::getEntityAddresses($this->federationClient, array_map(static fn($report) => $report->getReportingEntity(), $reports ?? [])),
            ];
        }

        /**
         * Builds report search suggestions.
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
                foreach($this->federationClient->searchReports($query, 1, 5) as $report)
                {
                    $items[] = [
                        'uuid' => $report->getUuid(),
                        'title' => ucwords(str_replace('_', ' ', $report->getIncidentType()->value)),
                        'subtitle' => $report->isOpened() ? 'Open' : 'Closed',
                        'url' => Functions::getRouteUrl('report_detail', pathVariables: ['report_uuid' => $report->getUuid()]),
                    ];
                }

                return ['results' => $items];
            }
            catch(\Throwable $e)
            {
                Logger::getLogger()->warning('Unable to load report search suggestions', $e);
                return ['results' => []];
            }
        }
    }
