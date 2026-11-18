<?php

    namespace WebKernel;

    use DynamicalWeb\WebSession;
    use Exception;
    use FederationLib\Enums\ClassificationFlag;
    use FederationLib\Enums\IncidentType;
    use FederationLib\FederationClient;
    use FederationLib\Objects\EntityRecord;
    use FederationLib\Objects\ReportRecord;

    class ReportReviewView
    {
        private FederationClient $federationClient;
        private ?ReportRecord $report = null;
        private bool $error = false;
        private ?EntityRecord $reportingEntity = null;
        /** @var array|null Evidence records, or null when loading failed. */
        private ?array $evidence = null;
        /** @var array<string, array> Attachments keyed by evidence UUID. */
        private array $attachments = [];
        /** @var int|null The number of other reports on the reporting entity, or null when unknown. */
        private ?int $otherReportCount = null;
        /** @var int|null The number of active blacklist records of the reporting entity, or null when unknown. */
        private ?int $activeBlacklistCount = null;
        /** @var array<string, string|null> Operator names keyed by UUID. */
        private array $operatorNames = [];
        /** @var array<string, string|null> Entity addresses keyed by UUID. */
        private array $entityAddresses = [];

        /**
         * ReportReviewView constructor.
         */
        public function __construct()
        {
            $this->federationClient = WebSession::get('federation_client');

            try
            {
                $this->report = Utilities::getReport($this->federationClient, WebSession::getRequest()->getPathParameter('report_uuid'));
            }
            catch(Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load report for review', $exception);
                $this->error = true;
                return;
            }

            $reportingEntityUuid = $this->report->getReportingEntity();
            if($this->federationClient instanceof CachingFederationClient)
            {
                // Records that only depend on the report are read together rather than one after another, then
                // taken from the cache below
                $client = $this->federationClient;
                $reportUuid = $this->report->getUuid();
                $hasReportingEntity = ViewAuthorization::canReadEntities() && $reportingEntityUuid !== null && $reportingEntityUuid !== '';
                $client->prefetch(array_filter([
                    $hasReportingEntity ? fn() => $client->getEntityRecord($reportingEntityUuid) : null,
                    ViewAuthorization::canReadEvidence() ? fn() => $client->listReportEvidenceRecords($reportUuid, includeConfidential: ViewAuthorization::canManageRecords()) : null,
                    $hasReportingEntity && ViewAuthorization::canReadReports() ? fn() => $client->listEntityReports($reportingEntityUuid) : null,
                    $hasReportingEntity && ViewAuthorization::canReadBlacklist() ? fn() => $client->listEntityBlacklistRecords($reportingEntityUuid) : null,
                    ViewAuthorization::canReadOperatorRecords() ? fn() => $client->getOperator($this->report->getSubmittingOperator()) : null,
                ]));
            }

            if(ViewAuthorization::canReadEntities() && $reportingEntityUuid !== null && $reportingEntityUuid !== '')
            {
                try
                {
                    $this->reportingEntity = $this->federationClient->getEntityRecord($reportingEntityUuid);
                }
                catch(Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load report reporting entity for review', $exception);
                }
            }

            if(ViewAuthorization::canReadEvidence())
            {
                try
                {
                    $this->evidence = array_map(
                        fn($evidence) => Utilities::withEvidenceMetadata($this->federationClient, $evidence),
                        $this->federationClient->listReportEvidenceRecords($this->report->getUuid(), includeConfidential: ViewAuthorization::canManageRecords())
                    );
                }
                catch(Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load report evidence for review', $exception);
                }
            }
            else
            {
                $this->evidence = [];
            }

            if($this->federationClient instanceof CachingFederationClient)
            {
                // The attachments of the evidence and the records its rows are labelled with are read together
                $this->federationClient->prefetchRecords(
                    entities: array_map(static fn($evidence): string => $evidence->getEntityUuid(), $this->evidence ?? []),
                    operators: ViewAuthorization::canReadOperatorRecords() ? array_merge([$this->report->getAssignedOperator()], array_map(static fn($evidence): string => $evidence->getOperatorUuid(), $this->evidence ?? [])) : [],
                    evidenceAttachments: ViewAuthorization::canManageRecords() ? array_map(static fn($evidence): string => $evidence->getUuid(), $this->evidence ?? []) : [],
                );
            }

            if(ViewAuthorization::canManageRecords())
            {
                foreach($this->evidence ?? [] as $evidence)
                {
                    try
                    {
                        $this->attachments[$evidence->getUuid()] = $this->federationClient->getEvidenceAttachments($evidence->getUuid());
                    }
                    catch(Exception $exception)
                    {
                        Logger::getLogger()->warning('Unable to load evidence attachments for review', $exception);
                        $this->attachments[$evidence->getUuid()] = [];
                    }
                }
            }

            if($this->reportingEntity !== null)
            {
                if(ViewAuthorization::canReadReports())
                {
                    try
                    {
                        $this->otherReportCount = count(array_filter($this->federationClient->listEntityReports($this->reportingEntity->getUuid()), fn($entityReport): bool => $entityReport->getUuid() !== $this->report->getUuid()));
                    }
                    catch(Exception $exception)
                    {
                        Logger::getLogger()->warning('Unable to load entity reports for review', $exception);
                    }
                }
                if(ViewAuthorization::canReadBlacklist())
                {
                    try
                    {
                        $this->activeBlacklistCount = count($this->federationClient->listEntityBlacklistRecords($this->reportingEntity->getUuid()));
                    }
                    catch(Exception $exception)
                    {
                        Logger::getLogger()->warning('Unable to load entity blacklist for review', $exception);
                    }
                }
            }

            $operatorUuids = [$this->report->getSubmittingOperator(), $this->report->getAssignedOperator()];
            $entityUuids = [$reportingEntityUuid];
            foreach($this->evidence ?? [] as $evidence)
            {
                $operatorUuids[] = $evidence->getOperatorUuid();
                $entityUuids[] = $evidence->getEntityUuid();
            }

            $this->operatorNames = Utilities::getOperatorNames($this->federationClient, $operatorUuids);
            $this->entityAddresses = Utilities::getEntityAddresses($this->federationClient, $entityUuids);
            if($this->reportingEntity !== null)
            {
                $this->entityAddresses[$this->reportingEntity->getUuid()] = $this->reportingEntity->getAddress();
            }
        }

        /**
         * Returns whether the report failed to load.
         *
         * @return bool Whether loading the report failed.
         */
        public function hasError(): bool
        {
            return $this->error;
        }

        /**
         * Returns the reviewed report.
         *
         * @return ReportRecord|null The report, or null when loading failed.
         */
        public function getReport(): ?ReportRecord
        {
            return $this->report;
        }

        /**
         * Returns the reporting entity record.
         *
         * @return EntityRecord|null The entity, or null when absent, unavailable or not permitted.
         */
        public function getReportingEntity(): ?EntityRecord
        {
            return $this->reportingEntity;
        }

        /**
         * Returns the evidence records of the report.
         *
         * @return array|null The evidence records, or null when loading failed.
         */
        public function getEvidence(): ?array
        {
            return $this->evidence;
        }

        /**
         * Returns the attachments of an evidence record.
         *
         * @param string $evidenceUuid The evidence UUID.
         * @return array The attachments, empty when there are none or they are not permitted.
         */
        public function getAttachments(string $evidenceUuid): array
        {
            return $this->attachments[$evidenceUuid] ?? [];
        }

        /**
         * Returns the number of other reports on the reporting entity.
         *
         * @return int|null The count, or null when unknown.
         */
        public function getOtherReportCount(): ?int
        {
            return $this->otherReportCount;
        }

        /**
         * Returns the number of active blacklist records of the reporting entity.
         *
         * @return int|null The count, or null when unknown.
         */
        public function getActiveBlacklistCount(): ?int
        {
            return $this->activeBlacklistCount;
        }

        /**
         * Returns an operator name by UUID.
         *
         * @param string|null $uuid The operator UUID.
         * @return string|null The operator name, or null when unavailable.
         */
        public function getOperatorName(?string $uuid): ?string
        {
            return $uuid === null ? null : ($this->operatorNames[$uuid] ?? null);
        }

        /**
         * Returns an entity address by UUID.
         *
         * @param string|null $uuid The entity UUID.
         * @return string|null The entity address, or null when unavailable.
         */
        public function getEntityAddress(?string $uuid): ?string
        {
            return $uuid === null ? null : ($this->entityAddresses[$uuid] ?? null);
        }

        /**
         * Returns the badge CSS class for an incident type.
         *
         * @param IncidentType $incidentType The incident type.
         * @return string The badge CSS class.
         */
        public function getIncidentBadge(IncidentType $incidentType): string
        {
            return Utilities::getIncidentBadge($incidentType);
        }

        /**
         * Returns the badge CSS class for an evidence classification.
         *
         * @param ClassificationFlag|null $classification The classification.
         * @return string The badge CSS class.
         */
        public function getClassificationBadge(?ClassificationFlag $classification): string
        {
            return Utilities::getClassificationBadge($classification);
        }

        /**
         * Returns an icon CSS class for a MIME type.
         *
         * @param string|null $mime The MIME type.
         * @return string The icon CSS class.
         */
        public function getMimeIcon(?string $mime): string
        {
            return Utilities::getMimeIcon($mime);
        }

        /**
         * Formats a byte count for display.
         *
         * @param int $bytes The number of bytes.
         * @return string The human-readable size.
         */
        public function formatSize(int $bytes): string
        {
            return Utilities::formatSize($bytes);
        }

        /**
         * Formats a timestamp for display.
         *
         * @param int $timestamp The Unix timestamp.
         * @param string $format The date format.
         * @return string The formatted date.
         */
        public function formatDate(int $timestamp, string $format='Y-m-d H:i'): string
        {
            return Utilities::formatDate($timestamp, $format);
        }
    }
