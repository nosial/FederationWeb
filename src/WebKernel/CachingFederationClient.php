<?php

    namespace WebKernel;

    use FederationLib\Exceptions\RequestException;
    use FederationLib\FederationClient;
    use FederationLib\Objects\EntityRecord;
    use FederationLib\Objects\EvidenceRecord;
    use FederationLib\Objects\FileAttachmentRecord;
    use FederationLib\Objects\OperatorRecord;
    use FederationLib\Objects\ReportRecord;
    use FederationLib\Objects\BlacklistRecord;
    use FederationLib\Objects\ServerInformation;

    /**
     * A federation client that remembers single-record reads for the rest of the request.
     *
     * <p>A page resolves the same operators and entities many times over: the record itself, the
     * labels of each table row, the related-record cards and the top bar all ask for them
     * separately. Each read below is sent to the server once per request, and a server error is
     * remembered as well, so a record that is missing or forbidden is not requested again. Operator
     * and entity lists also fill the per-record cache, so a listed record is not fetched again.
     *
     * <p>Only reads are cached, and the instance lives for a single request; it is created for GET
     * requests only, so a request that changes records never reads a copy from before its change.
     * Changing the access token clears the cache, since what the server returns depends on it.
     */
    class CachingFederationClient extends FederationClient
    {
        /** @var array<string, mixed> Results and remembered request failures keyed by method and arguments. */
        private array $cache = [];

        /**
         * @inheritDoc
         */
        public function setAccessToken(?string $accessToken): void
        {
            parent::setAccessToken($accessToken);
            $this->cache = [];
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
        public function getSelf(): OperatorRecord
        {
            return $this->remember('self', function(): OperatorRecord
            {
                $operator = parent::getSelf();
                $this->store('operator:' . $operator->getUuid(), $operator);
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
            return $this->remember($this->key('operators', [$page, $limit, $category, $by, $order]), function() use ($page, $limit, $category, $by, $order): array
            {
                $operators = parent::listOperators($page, $limit, $category, $by, $order);
                foreach($operators as $operator)
                {
                    $this->store('operator:' . $operator->getUuid(), $operator);
                }
                return $operators;
            });
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
                $this->store('entity:' . $entity->getUuid(), $entity);
                return $entity;
            });
        }

        /**
         * @inheritDoc
         */
        public function listEntities(int $page=1, int $limit=100, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->storeEntities(parent::listEntities($page, $limit, $category, $by, $order));
        }

        /**
         * @inheritDoc
         */
        public function searchEntities(string $query, int $page=1, int $limit=10, ?string $category=null, ?string $by=null, ?string $order=null): array
        {
            return $this->storeEntities(parent::searchEntities($query, $page, $limit, $category, $by, $order));
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
         * Returns the cached result for a key, or loads and remembers it. A request failure is
         * remembered and thrown again for later reads of the same key.
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
                try
                {
                    $this->cache[$key] = $load();
                }
                catch(RequestException $exception)
                {
                    $this->cache[$key] = $exception;
                }
            }

            if($this->cache[$key] instanceof RequestException)
            {
                throw $this->cache[$key];
            }

            return $this->cache[$key];
        }

        /**
         * Stores a value under a key unless the key already holds a result.
         *
         * @param string $key The cache key.
         * @param mixed $value The value to store.
         */
        private function store(string $key, mixed $value): void
        {
            if(!array_key_exists($key, $this->cache) || $this->cache[$key] instanceof RequestException)
            {
                $this->cache[$key] = $value;
            }
        }

        /**
         * Stores listed entities so that later lookups by UUID reuse them.
         *
         * @param EntityRecord[] $entities The listed entities.
         * @return EntityRecord[] The same entities.
         */
        private function storeEntities(array $entities): array
        {
            foreach($entities as $entity)
            {
                $this->store('entity:' . $entity->getUuid(), $entity);
            }
            return $entities;
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
