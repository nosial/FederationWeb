<?php

    namespace WebKernel;

    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use FederationLib\FederationClient;
    use FederationLib\Objects\ServerInformation;

    /**
     * Provides data and actions for the evidence records list view.
     */
    class EvidenceView
    {
        private bool $darkMode;
        private int $page;
        private int $limit;
        private ?string $searchQuery;
        private ?string $categoryFilter;
        private ?string $sortBy;
        private ?string $sortOrder;
        private ?string $apiOrder;
        private ?string $operatorId;
        private ?string $entityId;
        private ?array $evidenceRecords;
        private int $totalEvidence;
        private int $totalPages;
        /** @var array<string, string|null> Entity addresses keyed by UUID. */
        private array $entityAddresses;
        /** @var array<string, string|null> Operator names keyed by UUID. */
        private array $operatorNames;
        /** @var array<string, int|string> Active non-null query parameters. */
        private array $baseQuery;
        private ?string $successMsg;
        private ?string $errorMsg;
        private ?string $errorMessage;

        private bool $allRecords;
        private FederationClient $federationClient;
        private ServerInformation $serverInformation;

        /**
         * EvidenceView constructor.
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
            $page = WebSession::getRequest()->getIntParameter('page', 1, min: 1);
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
                'confidential' => 'CONFIDENTIAL',
                'not_confidential' => 'NOT_CONFIDENTIAL',
                'classified' => 'CLASSIFIED',
                'unclassified' => 'UNCLASSIFIED',
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
                if($operatorId !== null || $entityId !== null || $hasSearch || $hasCategoryFilter || $allRecords)
                {
                    $all = $this->loadFilteredEvidence($operatorId, $entityId, $searchQuery, $hasSearch, $apiCategory, $sortBy, $apiOrder);
                    $totalEvidence = count($all);
                    $totalPages = max(1, (int)ceil($totalEvidence / $this->limit));
                    $page = min($page, $totalPages);
                    $evidenceRecords = array_slice(array_values($all), ($page - 1) * $this->limit, $this->limit);
                }
                else
                {
                    $firstPage = $this->federationClient->listEvidence(page: 1, includeConfidential: ViewAuthorization::canManageRecords(), by: $sortBy, order: $apiOrder);
                    $this->limit = max(1, count($firstPage));
                    $totalEvidence = $this->serverInformation->getEvidenceRecords();
                    $totalPages = max(1, (int)ceil($totalEvidence / $this->limit));
                    $page = min($page, $totalPages);
                    $evidenceRecords = $page === 1 ? $firstPage : $this->federationClient->listEvidence(page: $page, includeConfidential: ViewAuthorization::canManageRecords(), by: $sortBy, order: $apiOrder);
                }
            }
            catch(\Exception $e)
            {
                Logger::getLogger()->warning('Unable to load evidence records', $e);
                $evidenceRecords = null;
                $totalEvidence = 0;
                $totalPages = 1;
            }

            [$entityAddresses, $operatorNames] = $this->loadRecordLabels($evidenceRecords);

            $this->darkMode = Utilities::getDarkMode();
            $this->page = $page;
            $this->searchQuery = $searchQuery;
            $this->categoryFilter = $categoryFilter;
            $this->sortBy = $sortBy;
            $this->sortOrder = $sortOrder;
            $this->apiOrder = $apiOrder;
            $this->operatorId = $operatorId;
            $this->entityId = $entityId;
            $this->evidenceRecords = $evidenceRecords;
            $this->totalEvidence = $totalEvidence;
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
            $statusMessages = Utilities::getStatusMessages();
            $this->successMsg = $statusMessages->successMessageKey;
            $this->errorMsg = $statusMessages->errorMessageKey;
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
         * Returns the maximum number of evidence records per page.
         *
         * @return int The page size.
         */
        public function getLimit(): int { return $this->limit; }
        /**
         * Returns the active evidence search query.
         *
         * @return string|null The query, or null when no search is active.
         */
        public function getSearchQuery(): ?string { return $this->searchQuery; }
        /**
         * Returns the active evidence category filter.
         *
         * @return string|null The filter, or null when none is active.
         */
        public function getCategoryFilter(): ?string { return $this->categoryFilter; }
        /**
         * Returns the active evidence sort field.
         *
         * @return string|null The sort field, or null when unsorted.
         */
        public function getSortBy(): ?string { return $this->sortBy; }
        /**
         * Returns the requested evidence sort order.
         *
         * @return string|null The sort order, or null when unspecified.
         */
        public function getSortOrder(): ?string { return $this->sortOrder; }
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
         * Returns the evidence records for the current page.
         *
         * @return array|null The evidence records, or null when loading failed.
         */
        public function getEvidenceRecords(): ?array { return $this->evidenceRecords; }
        /**
         * Returns the total number of matching evidence records.
         *
         * @return int The total evidence count.
         */
        public function getTotalEvidence(): int { return $this->totalEvidence; }
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
         * Returns the current success message key.
         *
         * @return string|null The success message key, or null when absent.
         */
        public function getSuccessMessage(): ?string { return $this->successMsg; }
        /**
         * Returns the current error message key.
         *
         * @return string|null The error message key, or null when absent.
         */
        public function getErrorMessage(): ?string { return $this->errorMsg; }
        /**
         * Returns the current error message detail.
         *
         * @return string|null The error detail, or null when absent.
         */
        public function getErrorDetail(): ?string { return $this->errorMessage; }
        /**
         * Formats a timestamp for display.
         *
         * @param int $timestamp The Unix timestamp to format.
         * @param string $format The date format string.
         * @return string The formatted date.
         */
        public function formatDate(int $timestamp, string $format='Y-m-d H:i'): string { return Utilities::formatDate($timestamp, $format); }
        /**
         * Returns the CSS badge class for an evidence classification.
         *
         * @param mixed $classification The classification value to render.
         * @return string The CSS badge class.
         */
        public function getClassificationBadge(mixed $classification): string
        {
            return match($classification?->name) {
                'MALICIOUS' => 'fw-badge-red',
                'SUSPICIOUS' => 'fw-badge-amber',
                'NORMAL' => 'fw-badge-green',
                default => 'fw-badge-gray',
            };
        }

        /**
         * Processes evidence actions and search-related requests.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest();
            $action = $request->getParameter('action');

            if($action === 'search_suggestions')
            {
                Utilities::respondWithJson($this->searchSuggestions(trim((string)$request->getParameter('q'))));
            }

            if($action === 'search_entities')
            {
                Utilities::respondWithJson($this->searchEntities(trim((string)$request->getParameter('q'))));
            }

            $queryParameters = $request->getQueryParameters();
            $redirectParameters = array_filter([
                'page' => $queryParameters['page'] ?? 1,
                'search_query' => $queryParameters['search_query'] ?? null,
                'category_filter' => $queryParameters['category_filter'] ?? null,
                'sort_by' => $queryParameters['sort_by'] ?? null,
                'sort_order' => $queryParameters['sort_order'] ?? null,
                'operator_id' => $queryParameters['operator_id'] ?? null,
                'entity_id' => $queryParameters['entity_id'] ?? null,
            ]);

            try
            {
                switch($action)
                {
                    case 'submit_evidence':
                        $entityIdentifier = $request->getParameter('entity_identifier');
                        if(empty($entityIdentifier))
                        {
                            throw new \Exception('Entity identifier is required');
                        }

                        $textContent = $request->getParameter('evidence_text');
                        if($textContent === '')
                        {
                            $textContent = null;
                        }

                        $note = $request->getParameter('evidence_note');
                        if($note === '')
                        {
                            $note = null;
                        }

                        $tag = $request->getParameter('evidence_tag');
                        if($tag === '')
                        {
                            $tag = null;
                        }
                        $this->federationClient->submitEvidence($entityIdentifier, $textContent, $note, $tag, $request->getParameter('evidence_confidential') === '1');
                        $redirectParameters['success'] = 'evidence_submitted';
                        break;

                    case 'delete_evidence':
                        $this->federationClient->deleteEvidence($request->getParameter('evidence_uuid'));
                        $redirectParameters['success'] = 'evidence_deleted';
                        break;
                }
            }
            catch(\Exception $e)
            {
                Logger::getLogger()->warning('Unable to process evidence action', $e);
                $redirectParameters['error'] = match ($action)
                {
                    'submit_evidence' => 'evidence_submit_failed',
                    'delete_evidence' => 'evidence_delete_failed',
                    default => $action . '_failed',
                };
                $redirectParameters['error_message'] = $e->getMessage();
            }

            Utilities::redirect('evidence', queryParameters: $redirectParameters);
        }

        /**
         * Loads evidence records matching active filters.
         *
         * @param string|null $operatorId The optional operator UUID filter.
         * @param string|null $entityId The optional entity UUID filter.
         * @param string|null $searchQuery The optional search text.
         * @param bool $hasSearch Whether a search was requested.
         * @param string|null $apiCategory The optional API category filter.
         * @param string|null $sortBy The optional sort field.
         * @param string|null $apiOrder The optional API sort order.
         * @return array The matching evidence records.
         */
        private function loadFilteredEvidence(?string $operatorId, ?string $entityId, ?string $searchQuery, bool $hasSearch, ?string $apiCategory, ?string $sortBy, ?string $apiOrder): array
        {
            if($operatorId !== null)
            {
                $evidence = $this->fetchAllPages(fn(int $page): array => $this->federationClient->listOperatorEvidence($operatorId, page: $page, includeConfidential: ViewAuthorization::canManageRecords(), by: $sortBy, order: $apiOrder));
            }
            elseif($entityId !== null)
            {
                $evidence = $this->fetchAllPages(fn(int $page): array => $this->federationClient->listEntityEvidenceRecords($entityId, page: $page, includeConfidential: ViewAuthorization::canManageRecords(), by: $sortBy, order: $apiOrder));
            }
            elseif($hasSearch && strlen($searchQuery) >= 2)
            {
                return $this->fetchAllPages(fn(int $page): array => $this->federationClient->searchEvidence($searchQuery, page: $page, category: $apiCategory, by: $sortBy, order: $apiOrder));
            }
            else
            {
                return $this->fetchAllPages(fn(int $page): array => $this->federationClient->listEvidence(page: $page, includeConfidential: ViewAuthorization::canManageRecords(), category: $apiCategory, by: $sortBy, order: $apiOrder));
            }

            if($hasSearch && strlen($searchQuery) >= 2)
            {
                $searchLower = strtolower($searchQuery);
                $evidence = array_filter($evidence, static function($evidenceRecord) use ($searchLower)
                {
                    return str_contains(strtolower($evidenceRecord->getTag() ?? ''), $searchLower)
                        || str_contains(strtolower($evidenceRecord->getUuid()), $searchLower);
                });
            }

            return $evidence;
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
         * Loads display labels for evidence entities and operators.
         *
         * @param array|null $evidenceRecords The evidence records whose labels are required.
         * @return array Entity-address and operator-name label maps.
         */
        private function loadRecordLabels(?array $evidenceRecords): array
        {
            return [
                Utilities::getEntityAddresses($this->federationClient, array_map(static fn($evidenceRecord) => $evidenceRecord->getEntityUuid(), $evidenceRecords ?? [])),
                Utilities::getOperatorNames($this->federationClient, array_map(static fn($evidenceRecord) => $evidenceRecord->getOperatorUuid(), $evidenceRecords ?? [])),
            ];
        }

        /**
         * Builds evidence search suggestions.
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
                foreach($this->federationClient->searchEvidence($query, 1, 5) as $evidenceRecord)
                {
                    $items[] = [
                        'uuid' => $evidenceRecord->getUuid(),
                        'title' => $evidenceRecord->getTag() ?? substr($evidenceRecord->getUuid(), 0, 8) . '…',
                        'subtitle' => 'Classification: ' . ($evidenceRecord->getClassificationFlag()?->name ?? 'None'),
                        'url' => Functions::getRouteUrl('evidence_detail', pathVariables: ['evidence_uuid' => $evidenceRecord->getUuid()]),
                    ];
                }

                return ['results' => $items];
            }
            catch(\Throwable $e)
            {
                Logger::getLogger()->warning('Unable to load evidence search suggestions', $e);
                return ['results' => []];
            }
        }

        /**
         * Builds entity suggestions for evidence submission.
         *
         * @param string $query The search text.
         * @return array The suggestion response payload.
         */
        private function searchEntities(string $query): array
        {
            if(strlen($query) < 2)
            {
                return ['results' => []];
            }

            try
            {
                $items = [];
                foreach($this->federationClient->searchEntities($query, 1, 10) as $entityRecord)
                {
                    $items[] = [
                        'uuid' => $entityRecord->getUuid(),
                        'address' => $entityRecord->getAddress(),
                    ];
                }

                return ['results' => $items];
            }
            catch(\Throwable $e)
            {
                Logger::getLogger()->warning('Unable to load entity search suggestions', $e);
                return ['results' => []];
            }
        }
    }