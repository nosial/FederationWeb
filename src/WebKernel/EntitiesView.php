<?php

    namespace WebKernel;

    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\WebSession;
    use FederationLib\FederationClient;
    use FederationLib\Objects\ServerInformation;

    /**
     * Provides data and actions for the entities list view.
     */
    class EntitiesView
    {
        private int $limit;

        private bool $darkMode;
        private int $page;
        private ?string $searchQuery;
        private ?string $categoryFilter;
        private ?string $sortBy;
        private ?string $sortOrder;
        private ?string $apiOrder;
        private ?array $entities;
        private int $totalEntities;
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
         * EntitiesView constructor.
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
            $this->categoryFilter = $query['category_filter'] ?? null;
            $this->sortBy = $query['sort_by'] ?? null;
            $this->sortOrder = $query['sort_order'] ?? null;
            $hasSearch = $this->searchQuery !== null && $this->searchQuery !== '';
            $hasCategoryFilter = $this->categoryFilter !== null && $this->categoryFilter !== '';
            $apiCategory = match ($this->categoryFilter) {'whitelisted' => 'WHITELISTED', 'not_whitelisted' => 'NOT_WHITELISTED', 'with_relationship' => 'WITH_RELATIONSHIP', 'without_relationship' => 'WITHOUT_RELATIONSHIP', default => null};
            $this->apiOrder = match (strtoupper($this->sortOrder ?? '')) {'ASC' => 'ASC', 'DESC' => 'DESC', default => null};
            try
            {
                if($hasSearch || $hasCategoryFilter || $allRecords)
                {
                    $entities = $this->fetchAllPages($hasSearch && strlen($this->searchQuery) >= 2
                        ? fn(int $page): array => $this->federationClient->searchEntities($this->searchQuery, page: $page, category: $apiCategory, by: $this->sortBy, order: $this->apiOrder)
                        : fn(int $page): array => $this->federationClient->listEntities(page: $page, category: $apiCategory, by: $this->sortBy, order: $this->apiOrder));
                    $this->totalEntities = count($entities);
                    $this->totalPages = max(1, (int)ceil($this->totalEntities / $this->limit));
                    $this->page = min($this->page, $this->totalPages);
                    $this->entities = array_slice($entities, ($this->page - 1) * $this->limit, $this->limit);
                }
                else
                {
                    $firstPage = $this->federationClient->listEntities(page: 1, by: $this->sortBy, order: $this->apiOrder);
                    $this->limit = max(1, count($firstPage));
                    $this->totalEntities = $this->serverInformation->getKnownEntities();
                    $this->totalPages = max(1, (int)ceil($this->totalEntities / $this->limit));
                    $this->page = min($this->page, $this->totalPages);
                    $this->entities = $this->page === 1 ? $firstPage : $this->federationClient->listEntities(page: $this->page, by: $this->sortBy, order: $this->apiOrder);
                }
            }
            catch(\Exception $e)
            {
                Logger::getLogger()->warning('Unable to load entities', $e);
                $this->entities = null;
                $this->totalEntities = 0;
                $this->totalPages = 1;
            }
            $this->darkMode = Utilities::getDarkMode();
            $this->baseQuery = array_filter(['search_query' => $this->searchQuery, 'category_filter' => $this->categoryFilter, 'sort_by' => $this->sortBy, 'sort_order' => $this->sortOrder]);
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
         * Returns the maximum number of entities per page.
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
         * Returns the active entity search query.
         *
         * @return string|null The query, or null when no search is active.
         */
        public function getSearchQuery(): ?string { return $this->searchQuery; }
        /**
         * Returns the active entity category filter.
         *
         * @return string|null The filter, or null when none is active.
         */
        public function getCategoryFilter(): ?string { return $this->categoryFilter; }
        /**
         * Returns the active entity sort field.
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
         * Returns the entities for the current page.
         *
         * @return array|null The entity records, or null when loading failed.
         */
        public function getEntities(): ?array { return $this->entities; }
        /**
         * Returns the total number of matching entities.
         *
         * @return int The total entity count.
         */
        public function getTotalEntities(): int { return $this->totalEntities; }
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
         * Resolves an entity UUID to its address.
         *
         * @param string $entityUuid The entity UUID to resolve.
         * @return string The entity address, or the UUID when it cannot be loaded.
         */
        public function getRelatedEntityAddress(string $entityUuid): string
        {
            try
            {
                return $this->federationClient->getEntityRecord($entityUuid)->getAddress();
            }
            catch(\Exception $e)
            {
                Logger::getLogger()->warning('Unable to load related entity address', $e);
                return $entityUuid;
            }
        }


        /**
         * Processes entity actions and search-suggestion requests.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest(); $action = $request->getParameter('action');
            if($action === 'search_suggestions')
            {
                $query = trim((string)$request->getParameter('q')); $results = [];
                if(strlen($query) >= 2) try { foreach($this->federationClient->searchEntities($query, 1, 5) as $entity) $results[] = ['uuid' => $entity->getUuid(), 'title' => $entity->getAddress(), 'subtitle' => 'Reputation: ' . $entity->getReputation(), 'url' => \DynamicalWeb\Html\Functions::getRouteUrl('entity_detail', pathVariables: ['entity_id' => $entity->getUuid()])]; } catch(\Throwable $e) { Logger::getLogger()->warning('Unable to load entity search suggestions', $e); }
                Utilities::respondWithJson(['results' => $results]);
            }
            $query = $request->getQueryParameters(); $redirect = array_filter(['page' => $query['page'] ?? 1, 'search_query' => $query['search_query'] ?? null, 'category_filter' => $query['category_filter'] ?? null, 'sort_by' => $query['sort_by'] ?? null, 'sort_order' => $query['sort_order'] ?? null]);
            try { if($action === 'create_entity') { $host = $request->getParameter('entity_host'); if(empty($host)) throw new \Exception('Host is required'); $id = $request->getParameter('entity_id') ?: null; $metadataRaw = $request->getParameter('entity_metadata'); $metadata = empty($metadataRaw) ? null : json_decode($metadataRaw, true); if(!empty($metadataRaw) && !is_array($metadata)) throw new \Exception('Invalid metadata JSON'); $this->federationClient->pushEntity($host, $id, $metadata); $redirect['success'] = 'entity_created'; } elseif($action === 'delete_entity') { $this->federationClient->deleteEntity($request->getParameter('entity_identifier')); $redirect['success'] = 'entity_deleted'; } } catch(\Exception $e) { Logger::getLogger()->warning('Unable to process entity action', $e); $redirect['error'] = $action === 'create_entity' ? 'entity_created_failed' : 'entity_delete_failed'; $redirect['error_message'] = $e->getMessage(); }
            Utilities::redirect('entities', queryParameters: $redirect);
        }
    }
