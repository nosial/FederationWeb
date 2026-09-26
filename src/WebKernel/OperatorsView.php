<?php

    namespace WebKernel;

    use DynamicalWeb\Enums\RequestMethod;
    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use Exception;
    use FederationLib\FederationClient;
    use FederationLib\Objects\ServerInformation;
    use Throwable;

    /**
     * Provides data and actions for the operators list view.
     */
    class OperatorsView
    {
        private int $limit;
        private bool $darkMode;
        private int $page;
        private ?string $searchQuery;
        private ?string $statusFilter;
        private ?string $permissionsFilter;
        private ?string $sortBy;
        private ?string $sortOrder;
        private string $apiOrder;
        private ?array $operators;
        private int $totalOperators;
        private int $totalPages;
        /** @var array<string, int|string> Active non-null query parameters. */
        private array $baseQuery;
        private ?string $successMessage;
        private ?string $errorMessageKey;
        private ?string $errorMessage;
        private bool $allRecords;
        private FederationClient $federationClient;
        private ServerInformation $serverInformation;

        /**
         * OperatorsView constructor.
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
            $this->page = max(1, (int)($query['page'] ?? 1));
            $this->searchQuery = $query['search_query'] ?? null;
            $this->statusFilter = $query['status_filter'] ?? null;
            $this->permissionsFilter = $query['permissions_filter'] ?? null;
            $this->sortBy = $query['sort_by'] ?? null;
            $this->sortOrder = $query['sort_order'] ?? null;
            $hasSearch = $this->searchQuery !== null && $this->searchQuery !== '';
            $hasStatusFilter = $this->statusFilter !== null && $this->statusFilter !== '';
            $hasPermissionsFilter = $this->permissionsFilter !== null && $this->permissionsFilter !== '';
            $apiCategory = match ($this->statusFilter)
            {
                'active' => 'ENABLED',
                'disabled' => 'DISABLED',
                default => null,
            };
            $this->apiOrder = strtoupper($this->sortOrder ?? '') === 'DESC' ? 'DESC' : 'ASC';

            try
            {
                if($hasSearch || $hasStatusFilter || $hasPermissionsFilter || $allRecords)
                {
                    $operators = $hasSearch && strlen($this->searchQuery) >= 2
                        ? $this->fetchAllPages(fn(int $page): array => $this->federationClient->searchOperators($this->searchQuery, page: $page, category: $apiCategory, by: $this->sortBy, order: $this->apiOrder))
                        : $this->fetchAllPages(fn(int $page): array => $this->federationClient->listOperators(page: $page, category: $apiCategory, by: $this->sortBy, order: $this->apiOrder));
                    if($hasPermissionsFilter)
                    {
                        $operators = array_values(array_filter($operators, function($operator): bool
                        {
                            return match ($this->permissionsFilter)
                            {
                                'client' => $operator->hasClientPermissions(),
                                'management' => $operator->hasManagementPermissions(),
                                'operator' => $operator->hasOperatorPermissions(),
                                default => true,
                            };
                        }));
                    }
                    $this->totalOperators = count($operators);
                    $this->totalPages = max(1, (int)ceil($this->totalOperators / $this->limit));
                    $this->page = min($this->page, $this->totalPages);
                    $this->operators = array_slice($operators, ($this->page - 1) * $this->limit, $this->limit);
                }
                else
                {
                    $firstPage = $this->federationClient->listOperators(page: 1, by: $this->sortBy, order: $this->apiOrder);
                    $this->limit = max(1, count($firstPage));
                    $this->totalOperators = $this->serverInformation->getOperators();
                    $this->totalPages = max(1, (int)ceil($this->totalOperators / $this->limit));
                    $this->page = min($this->page, $this->totalPages);
                    $this->operators = $this->page === 1 ? $firstPage : $this->federationClient->listOperators(page: $this->page, by: $this->sortBy, order: $this->apiOrder);
                }
            }
            catch(Exception $e)
            {
                Logger::getLogger()->warning('Unable to load operators', $e);
                $this->operators = null;
                $this->totalOperators = 0;
                $this->totalPages = 1;
            }

            $this->darkMode = Utilities::getDarkMode();
            $this->baseQuery = array_filter([
                'search_query' => $this->searchQuery,
                'status_filter' => $this->statusFilter,
                'permissions_filter' => $this->permissionsFilter,
                'sort_by' => $this->sortBy,
                'sort_order' => $this->sortOrder
            ]);
            $statusMessages = Utilities::getStatusMessages();
            $this->successMessage = $statusMessages->successMessageKey;
            $this->errorMessageKey = $statusMessages->errorMessageKey;
            $this->errorMessage = $statusMessages->errorDetail;
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
         * Returns the maximum number of operators per page.
         *
         * @return int The page size.
         */
        public function getLimit(): int { return $this->limit; }

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
         * Returns the active operator search query.
         *
         * @return string|null The query, or null when no search is active.
         */
        public function getSearchQuery(): ?string { return $this->searchQuery; }
        /**
         * Returns the active operator status filter.
         *
         * @return string|null The filter, or null when none is active.
         */
        public function getStatusFilter(): ?string { return $this->statusFilter; }
        /**
         * Returns the active permissions filter.
         *
         * @return string|null The filter, or null when none is active.
         */
        public function getPermissionsFilter(): ?string { return $this->permissionsFilter; }
        /**
         * Returns the active operator sort field.
         *
         * @return string|null The sort field, or null when unsorted.
         */
        public function getSortBy(): ?string { return $this->sortBy; }
        /**
         * Returns the normalized API sort order.
         *
         * @return string The API sort order.
         */
        public function getApiOrder(): string { return $this->apiOrder; }
        /**
         * Returns the operators for the current page.
         *
         * @return array|null The operator records, or null when loading failed.
         */
        public function getOperators(): ?array { return $this->operators; }
        /**
         * Returns the total number of matching operators.
         *
         * @return int The total operator count.
         */
        public function getTotalOperators(): int { return $this->totalOperators; }
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
        public function getErrorMessageKey(): ?string { return $this->errorMessageKey; }
        /**
         * Returns the current error message detail.
         *
         * @return string|null The error detail, or null when absent.
         */
        public function getErrorMessage(): ?string { return $this->errorMessage; }
        /**
         * Formats a timestamp for display.
         *
         * @param int $timestamp The Unix timestamp to format.
         * @param string $format The date format string.
         * @return string The formatted date.
         */
        public function formatDate(int $timestamp, string $format='Y-m-d H:i'): string { return Utilities::formatDate($timestamp, $format); }


        /**
         * Processes operator actions and search-suggestion requests.
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
            $redirect = array_filter(['page' => $query['page'] ?? 1, 'search_query' => $query['search_query'] ?? null, 'status_filter' => $query['status_filter'] ?? null, 'permissions_filter' => $query['permissions_filter'] ?? null, 'sort_by' => $query['sort_by'] ?? null, 'sort_order' => $query['sort_order'] ?? null]);
            try
            {
                $uuid = $request->getParameter('operator_uuid');
                switch($action)
                {
                    case 'create_operator':
                        $name = $request->getParameter('operator_name');
                        if(empty($name)) throw new Exception('Operator name is required');
                        $this->federationClient->createOperator($name);
                        $redirect['success'] = 'operator_created';
                        break;
                    case 'delete_operator': $this->federationClient->deleteOperator($uuid); $redirect['success'] = 'operator_deleted'; break;
                    case 'enable_operator': $this->federationClient->enableOperator($uuid); $redirect['success'] = 'operator_enabled'; break;
                    case 'disable_operator': $this->federationClient->disableOperator($uuid); $redirect['success'] = 'operator_disabled'; break;
                    case 'toggle_auto_assign':
                        $operator = $this->federationClient->getOperator($uuid);
                        $this->federationClient->setAutoAssign($uuid, !$operator->isAutoAssigned());
                        $redirect['success'] = $operator->isAutoAssigned() ? 'auto_assign_disabled' : 'auto_assign_enabled';
                        break;
                }
            }
            catch(Exception $e)
            {
                Logger::getLogger()->warning('Unable to process operator action', $e);
                $redirect['error'] = match ($action)
                {
                    'create_operator' => 'operator_created_failed',
                    'delete_operator' => 'operator_delete_failed',
                    'enable_operator' => 'operator_enable_failed',
                    'disable_operator' => 'operator_disable_failed',
                    'toggle_auto_assign' => 'auto_assign_update_failed',
                    default => $action . '_failed',
                };
                $redirect['error_message'] = $e->getMessage();
            }
            Utilities::redirect('operators', queryParameters: $redirect);
        }

        /**
         * Builds operator search suggestions.
         *
         * @param string $query The search text.
         * @return array The suggestion response payload.
         */
        private function searchSuggestions(string $query): array
        {
            if(strlen($query) < 2) return ['results' => []];

            try
            {
                $results = [];
                foreach($this->federationClient->searchOperators($query, 1, 5) as $operator)
                {
                    $results[] = ['uuid' => $operator->getUuid(), 'title' => $operator->getName(), 'subtitle' => $operator->isDisabled() ? 'Disabled' : 'Active', 'url' => Functions::getRouteUrl('operator_detail', pathVariables: ['operator_id' => $operator->getUuid()])];
                }
                return ['results' => $results];
            }
            catch(Throwable $e)
            {
                Logger::getLogger()->warning('Unable to load operator search suggestions', $e);
                return ['results' => []];
            }
        }
    }
