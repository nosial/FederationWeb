<?php

    namespace WebKernel;

    use DynamicalWeb\Classes\Memcache;
    use FederationLib\Exceptions\RequestException;
    use FederationLib\FederationClient;
    use FederationLib\Objects\AuditLog;
    use FederationLib\Objects\EntityRecord;
    use FederationLib\Objects\EvidenceRecord;
    use FederationLib\Objects\FileAttachmentRecord;
    use FederationLib\Objects\OperatorRecord;
    use FederationLib\Objects\ReportRecord;
    use FederationLib\Objects\BlacklistRecord;
    use FederationLib\Objects\ServerInformation;

    /**
     * A federation client that remembers reads for the rest of the request, and shares them between
     * requests through DynamicalWeb's memcached instance.
     *
     * <p>A page resolves the same operators and entities many times over: the record itself, the
     * labels of each table row, the related-record cards and the top bar all ask for them
     * separately. Each read below is sent to the server once per request, and a server error is
     * remembered as well, so a record that is missing or forbidden is not requested again. Operator
     * and entity lists also fill the per-record cache, so a listed record is not fetched again.
     *
     * <p>Successful reads are also kept in memcached for {@see CachingFederationClient::getSharedCacheTtl()}
     * seconds, so moving between pages, paging through a table or reloading one does not fetch the
     * same records again. Shared entries are scoped to the server endpoint and the access token, since
     * what the server returns depends on both, and every scope of an endpoint belongs to a generation
     * that {@see CachingFederationClient::invalidateSharedCache()} advances after a request that changes
     * records, so a change made through the web application is seen on the next page. Changes made
     * elsewhere (other clients of the server) are seen once the entries expire. Failures are never shared.
     *
     * <p>Only reads are cached, and the instance lives for a single request; it is created for GET
     * requests only, so a request that changes records never reads a copy from before its change.
     * Changing the access token clears the cache, since what the server returns depends on it.
     */
    class CachingFederationClient extends FederationClient
    {
        /** Seconds shared entries are kept when FEDERATION_CACHE_TTL is not set. */
        private const int DEFAULT_SHARED_CACHE_TTL = 60;

        /** Memcached key prefix of the generation counter of each server endpoint. */
        private const string GENERATION_KEY = 'fw_generation:';

        /** @var array<string, mixed> Results and remembered request failures keyed by method and arguments. */
        private array $cache = [];

        /** @var string|false|null The shared cache scope, false when the shared cache is unavailable, null until resolved. */
        private string|false|null $sharedScope = null;

        /**
         * Returns how long shared entries are kept, configured by the FEDERATION_CACHE_TTL environment
         * variable in seconds.
         *
         * @return int The time-to-live in seconds, 0 when the shared cache is disabled.
         */
        public static function getSharedCacheTtl(): int
        {
            $ttl = getenv('FEDERATION_CACHE_TTL');
            if($ttl === false || trim($ttl) === '')
            {
                return self::DEFAULT_SHARED_CACHE_TTL;
            }

            return ctype_digit(trim($ttl)) ? (int)trim($ttl) : self::DEFAULT_SHARED_CACHE_TTL;
        }

        /**
         * Discards every shared entry of a server endpoint, for every access token, by advancing its
         * generation. Called after requests that change records.
         *
         * @param string $endpoint The server endpoint.
         */
        public static function invalidateSharedCache(string $endpoint): void
        {
            if(self::getSharedCacheTtl() > 0)
            {
                // A counter memcached evicted starts again from the current time, ahead of the generations
                // still referenced by entries that have not expired yet
                Memcache::increment(self::getGenerationKey($endpoint), 1, time());
            }
        }

        /**
         * @inheritDoc
         */
        public function setAccessToken(?string $accessToken): void
        {
            parent::setAccessToken($accessToken);
            $this->cache = [];
            $this->sharedScope = null;
        }

        /**
         * @inheritDoc
         */
        public function getServerInformation(): ServerInformation
        {
            return $this->remember('info', fn() => parent::getServerInformation());
        }

        /**
         * @inheritDoc
         */
        public function getSpecification(): array
        {
            return $this->remember('specification', fn() => parent::getSpecification());
        }

        /**
         * @inheritDoc
         */
        public function search(string $query, ?array $types=null, int $page=1, int $limit=10): array
        {
            return $this->remember($this->key('search', [$query, $types, $page, $limit]), fn() => parent::search($query, $types, $page, $limit));
        }

        /**
         * @inheritDoc
         */
        public function getAuditLogRecord(string $auditLogUuid): AuditLog
        {
            return $this->remember('audit_log:' . $auditLogUuid, fn() => parent::getAuditLogRecord($auditLogUuid));
        }

        /**
         * @inheritDoc
         */
        public function listAuditLogs(int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('audit_logs', [$page, $limit, $category, $by, $order]),
                fn() => parent::listAuditLogs($page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function searchAuditLogs(string $query, int $page=1, int $limit=10, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('audit_logs_search', [$query, $page, $limit, $category, $by, $order]),
                fn() => parent::searchAuditLogs($query, $page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function getSelf(): OperatorRecord
        {
            return $this->remember('self', function(): OperatorRecord
            {
                $operator = parent::getSelf();
                $this->storeRecords('operator:', [$operator]);
                return $operator;
            });
        }

        /**
         * @inheritDoc
         */
        public function getOperator(string $operatorUuid): OperatorRecord
        {
            return $this->remember('operator:' . $operatorUuid, fn() => parent::getOperator($operatorUuid));
        }

        /**
         * @inheritDoc
         */
        public function listOperators(int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('operators', [$page, $limit, $category, $by, $order]),
                fn() => $this->storeRecords('operator:', parent::listOperators($page, $limit, $category, $by, $order)));
        }

        /**
         * @inheritDoc
         */
        public function searchOperators(string $query, int $page=1, int $limit=10, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('operators_search', [$query, $page, $limit, $category, $by, $order]),
                fn() => $this->storeRecords('operator:', parent::searchOperators($query, $page, $limit, $category, $by, $order)));
        }

        /**
         * @inheritDoc
         */
        public function listOperatorAuditLogs(string $operatorUuid, int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('operator_audit_logs', [$operatorUuid, $page, $limit, $category, $by, $order]),
                fn() => parent::listOperatorAuditLogs($operatorUuid, $page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function listOperatorEvidence(string $operatorUuid, int $page=1, int $limit=100, bool $includeConfidential=false, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('operator_evidence', [$operatorUuid, $page, $limit, $includeConfidential, $by, $order]),
                fn() => parent::listOperatorEvidence($operatorUuid, $page, $limit, $includeConfidential, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function listOperatorBlacklist(string $operatorUuid, int $page=1, int $limit=100, bool $includeLifted=false, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('operator_blacklist', [$operatorUuid, $page, $limit, $includeLifted, $by, $order]),
                fn() => parent::listOperatorBlacklist($operatorUuid, $page, $limit, $includeLifted, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function listOperatorReports(string $operatorUuid, int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('operator_reports', [$operatorUuid, $page, $limit, $category, $by, $order]),
                fn() => parent::listOperatorReports($operatorUuid, $page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function listAssignedOperatorReports(string $operatorUuid, int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('assigned_reports', [$operatorUuid, $page, $limit, $category, $by, $order]),
                fn() => parent::listAssignedOperatorReports($operatorUuid, $page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function getEntityRecord(string $entityIdentifier): EntityRecord
        {
            return $this->remember('entity:' . $entityIdentifier, function() use ($entityIdentifier): EntityRecord
            {
                // An entity looked up by hash or address is also found again by its UUID.
                $entity = parent::getEntityRecord($entityIdentifier);
                $this->storeRecords('entity:', [$entity]);
                return $entity;
            });
        }

        /**
         * @inheritDoc
         */
        public function listEntities(int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('entities', [$page, $limit, $category, $by, $order]),
                fn() => $this->storeRecords('entity:', parent::listEntities($page, $limit, $category, $by, $order)));
        }

        /**
         * @inheritDoc
         */
        public function searchEntities(string $query, int $page=1, int $limit=10, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('entities_search', [$query, $page, $limit, $category, $by, $order]),
                fn() => $this->storeRecords('entity:', parent::searchEntities($query, $page, $limit, $category, $by, $order)));
        }

        /**
         * @inheritDoc
         */
        public function listEntityAuditLogs(string $entityIdentifier, int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('entity_audit_logs', [$entityIdentifier, $page, $limit, $category, $by, $order]),
                fn() => parent::listEntityAuditLogs($entityIdentifier, $page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function listEntityBlacklistRecords(string $entityIdentifier, int $page=1, int $limit=100, bool $includeLifted=false, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('entity_blacklist', [$entityIdentifier, $page, $limit, $includeLifted, $by, $order]),
                fn() => parent::listEntityBlacklistRecords($entityIdentifier, $page, $limit, $includeLifted, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function listEntityEvidenceRecords(string $entityIdentifier, int $page=1, int $limit=100, bool $includeConfidential=false, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('entity_evidence', [$entityIdentifier, $page, $limit, $includeConfidential, $by, $order]),
                fn() => parent::listEntityEvidenceRecords($entityIdentifier, $page, $limit, $includeConfidential, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function listEntityReports(string $entityIdentifier, int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('entity_reports', [$entityIdentifier, $page, $limit, $category, $by, $order]),
                fn() => parent::listEntityReports($entityIdentifier, $page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function listReports(int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('reports', [$page, $limit, $category, $by, $order]),
                fn() => parent::listReports($page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function searchReports(string $query, int $page=1, int $limit=10, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('reports_search', [$query, $page, $limit, $category, $by, $order]),
                fn() => parent::searchReports($query, $page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function listReportEvidenceRecords(string $reportUuid, int $page=1, int $limit=100, bool $includeConfidential=false, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('report_evidence', [$reportUuid, $page, $limit, $includeConfidential, $category, $by, $order]),
                fn() => parent::listReportEvidenceRecords($reportUuid, $page, $limit, $includeConfidential, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function getReport(string $reportUuid): ReportRecord
        {
            return $this->remember('report:' . $reportUuid, fn() => parent::getReport($reportUuid));
        }

        /**
         * @inheritDoc
         */
        public function getEvidenceRecord(string $evidenceUuid): EvidenceRecord
        {
            return $this->remember('evidence:' . $evidenceUuid, fn() => parent::getEvidenceRecord($evidenceUuid));
        }

        /**
         * @inheritDoc
         */
        public function listEvidence(int $page=1, int $limit=100, bool $includeConfidential=false, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('evidence', [$page, $limit, $includeConfidential, $category, $by, $order]),
                fn() => parent::listEvidence($page, $limit, $includeConfidential, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function searchEvidence(string $query, int $page=1, int $limit=10, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->remember($this->key('evidence_search', [$query, $page, $limit, $category, $by, $order]),
                fn() => parent::searchEvidence($query, $page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function getEvidenceAttachments(string $evidenceUuid): array
        {
            return $this->remember('evidence_attachments:' . $evidenceUuid, fn() => parent::getEvidenceAttachments($evidenceUuid));
        }

        /**
         * @inheritDoc
         */
        public function getBlacklistRecord(string $blacklistRecordUuid): BlacklistRecord
        {
            return $this->remember('blacklist:' . $blacklistRecordUuid, fn() => parent::getBlacklistRecord($blacklistRecordUuid));
        }

        /**
         * @inheritDoc
         */
        public function listBlacklistRecords(int $page=1, int $limit=100, bool $includeLifted=false, ?string $category=null, ?string $by=null, ?string $order=null, ?array $types=null): array
        {
            return $this->remember($this->key('blacklist', [$page, $limit, $includeLifted, $category, $by, $order, $types]),
                fn() => parent::listBlacklistRecords($page, $limit, $includeLifted, $category, $by, $order, $types));
        }

        /**
         * @inheritDoc
         */
        public function searchBlacklist(string $query, int $page=1, int $limit=10, ?string $category=null, ?string $by=null, ?string $order=null, ?array $types=null): array
        {
            return $this->remember($this->key('blacklist_search', [$query, $page, $limit, $category, $by, $order, $types]),
                fn() => parent::searchBlacklist($query, $page, $limit, $category, $by, $order, $types));
        }

        /**
         * @inheritDoc
         */
        public function getAttachmentInfo(string $attachmentUuid): FileAttachmentRecord
        {
            return $this->remember('attachment:' . $attachmentUuid, fn() => parent::getAttachmentInfo($attachmentUuid));
        }

        /**
         * Returns whether an operator record is already known, so that callers can decide whether
         * loading the operator list is cheaper than looking operators up one at a time.
         *
         * @param string $operatorUuid The operator UUID.
         * @return bool True when the operator was already read or listed in this request.
         */
        public function hasOperator(string $operatorUuid): bool
        {
            return array_key_exists('operator:' . $operatorUuid, $this->cache);
        }

        /**
         * Returns the cached result for a key, from this request or the shared cache, or loads and
         * remembers it. A request failure is remembered for this request only and thrown again for
         * later reads of the same key.
         *
         * @template T
         * @param string $key The cache key.
         * @param callable(): T $load Loads the value from the server.
         * @return T The cached or loaded value.
         * @throws RequestException When the server request fails, now or on the first read.
         */
        private function remember(string $key, callable $load): mixed
        {
            if(!array_key_exists($key, $this->cache))
            {
                $shared = $this->fetchShared($key);
                if($shared !== null)
                {
                    $this->cache[$key] = $shared[0];
                }
                else
                {
                    try
                    {
                        $this->cache[$key] = $load();
                        $this->storeShared([$key => $this->cache[$key]]);
                    }
                    catch(RequestException $exception)
                    {
                        $this->cache[$key] = $exception;
                    }
                }
            }

            if($this->cache[$key] instanceof RequestException)
            {
                throw $this->cache[$key];
            }

            return $this->cache[$key];
        }

        /**
         * Stores records under their UUID, in this request and the shared cache, so that later
         * lookups by UUID reuse them. A record this request already holds is kept.
         *
         * @template T of OperatorRecord|EntityRecord
         * @param string $prefix The cache key prefix of the record type, such as 'entity:'.
         * @param T[] $records The records.
         * @return T[] The same records.
         */
        private function storeRecords(string $prefix, array $records): array
        {
            $items = [];
            foreach($records as $record)
            {
                $key = $prefix . $record->getUuid();
                if(!array_key_exists($key, $this->cache) || $this->cache[$key] instanceof RequestException)
                {
                    $this->cache[$key] = $record;
                }
                $items[$key] = $record;
            }

            $this->storeShared($items);
            return $records;
        }

        /**
         * Fetches an entry from the shared cache.
         *
         * @param string $key The cache key.
         * @return array{0: mixed}|null The value wrapped in an array, or null on a miss or when the
         *         shared cache is unavailable.
         */
        private function fetchShared(string $key): ?array
        {
            $scope = $this->getSharedScope();
            if($scope === false)
            {
                return null;
            }

            $success = false;
            $value = Memcache::fetch($this->getSharedKey($scope, $key), $success);
            return $success ? [$value] : null;
        }

        /**
         * Stores entries in the shared cache.
         *
         * @param array<string, mixed> $items The values keyed by cache key.
         */
        private function storeShared(array $items): void
        {
            $scope = $this->getSharedScope();
            if($scope === false || count($items) === 0)
            {
                return;
            }

            $entries = [];
            foreach($items as $key => $value)
            {
                $entries[$this->getSharedKey($scope, $key)] = $value;
            }

            Memcache::storeMultiple($entries, self::getSharedCacheTtl());
        }

        /**
         * Returns the shared cache scope of this client: the generation of its endpoint and a hash of
         * the endpoint and access token. Resolved once per request and access token.
         *
         * @return string|false The scope, or false when the shared cache is disabled or unavailable.
         */
        private function getSharedScope(): string|false
        {
            if($this->sharedScope === null)
            {
                $this->sharedScope = false;
                if(self::getSharedCacheTtl() > 0 && Memcache::isAvailable())
                {
                    $generationKey = self::getGenerationKey($this->getEndpoint());
                    $success = false;
                    $generation = Memcache::fetch($generationKey, $success);
                    if(!$success)
                    {
                        // Another request may have created the counter in the meantime, so it is read again
                        Memcache::add($generationKey, time());
                        $generation = Memcache::fetch($generationKey, $success);
                    }

                    if($success)
                    {
                        $this->sharedScope = $generation . ':' . hash('sha256', $this->getEndpoint() . "\n" . ($this->getAccessToken() ?? ''));
                    }
                }
            }

            return $this->sharedScope;
        }

        /**
         * Builds the memcached key of a cache key within a scope. Keys are hashed, since memcached keys
         * are limited in length and cannot hold the spaces of search queries.
         *
         * @param string $scope The shared cache scope.
         * @param string $key The cache key.
         * @return string The memcached key.
         */
        private function getSharedKey(string $scope, string $key): string
        {
            return 'fw_client:' . hash('sha256', $scope . "\n" . $key);
        }

        /**
         * Returns the memcached key of the generation counter of a server endpoint.
         *
         * @param string $endpoint The server endpoint.
         * @return string The memcached key.
         */
        private static function getGenerationKey(string $endpoint): string
        {
            return self::GENERATION_KEY . hash('sha256', $endpoint);
        }

        /**
         * Builds a cache key from a method name and its arguments.
         *
         * @param string $method The method name.
         * @param array $arguments Every parameter of the call, defaults included, so equal calls share a key.
         * @return string The cache key.
         */
        private function key(string $method, array $arguments): string
        {
            return $method . ':' . json_encode($arguments);
        }
    }
