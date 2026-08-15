<?php

    namespace WebKernel;

    use Exception;
    use DynamicalWeb\WebSession;
    use DynamicalWeb\Classes\Logger;
    use FederationLib\Enums\AuditLogType;
    use FederationLib\Enums\Categories\AuditLogCategory;
    use FederationLib\FederationClient;
    use FederationLib\Objects\ServerInformation;

    /**
     * Supplies dashboard data and presentation helpers.
     */
    class DashboardView
    {
        /** @var array<int, array|null> */
        private array $auditLogs = [];
        private ?array $topThreats = null;
        private ?array $recentEvidence = null;
        private ServerInformation $serverInformation;
        private ?FederationClient $federationClient;
        /** @var array<string, string|null> */
        private array $operatorNames = [];
        /** @var array<string, string|null> */
        private array $entityAddresses = [];

        /**
         * DashboardView constructor.
         */
        public function __construct()
        {
            $this->serverInformation = WebSession::get('server_information');
            $this->federationClient = WebSession::get('federation_client');
        }

        /**
         * Retrieve a page of recent audit logs.
         *
         * @param int $limit Maximum number of audit logs to retrieve.
         * @return array|null Audit log records, or null when they cannot be loaded.
         */
        public function getAuditLogs(int $limit): ?array
        {
            if (array_key_exists($limit, $this->auditLogs))
            {
                return $this->auditLogs[$limit];
            }

            try
            {
                return $this->auditLogs[$limit] = $this->federationClient?->listAuditLogs(1, $limit);
            }
            catch (Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load dashboard audit logs', $exception);
                return $this->auditLogs[$limit] = null;
            }
        }

        /**
         * Retrieve the dashboard's top threats.
         *
         * @return array|null Top threat records, or null when they cannot be loaded.
         */
        public function getTopThreats(): ?array
        {
            if ($this->topThreats !== null)
            {
                return $this->topThreats;
            }

            try
            {
                return $this->topThreats = $this->federationClient?->getTopThreats(4);
            }
            catch (Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load dashboard top threats', $exception);
                return null;
            }
        }

        /**
         * Retrieve recently submitted evidence.
         *
         * @return array|null Recent evidence records, or null when they cannot be loaded.
         */
        public function getRecentEvidence(): ?array
        {
            if ($this->recentEvidence !== null)
            {
                return $this->recentEvidence;
            }

            try
            {
                return $this->recentEvidence = $this->federationClient?->listEvidence(1, 4);
            }
            catch (Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load dashboard recent evidence', $exception);
                return null;
            }
        }

        /**
         * Retrieve the audit log types visible to the public.
         *
         * @return array Names of publicly visible audit log types.
         */
        public function getVisibleAuditLogTypes(): array
        {
            try
            {
                $types = $this->serverInformation->getPublicAuditLogsVisibility();
                if (is_array($types))
                {
                    return array_map(static fn($type): string => $type->name ?? (string)$type, $types);
                }
            }
            catch (Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load visible audit log types', $exception);
            }

            return array_map(static fn(AuditLogType $type): string => $type->name, AuditLogType::getDefaultPublic());
        }

        /**
         * Resolve an operator UUID to its current display name.
         */
        public function getOperatorName(?string $uuid): ?string
        {
            if ($uuid === null || $uuid === '')
            {
                return null;
            }

            if (array_key_exists($uuid, $this->operatorNames))
            {
                return $this->operatorNames[$uuid];
            }

            try
            {
                return $this->operatorNames[$uuid] = $this->federationClient?->getOperator($uuid)->getName();
            }
            catch (Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load dashboard operator label', $exception);
                return $this->operatorNames[$uuid] = null;
            }
        }

        /**
         * Resolve an entity UUID to its current address.
         */
        public function getEntityAddress(?string $uuid): ?string
        {
            if ($uuid === null || $uuid === '')
            {
                return null;
            }

            if (array_key_exists($uuid, $this->entityAddresses))
            {
                return $this->entityAddresses[$uuid];
            }

            try
            {
                return $this->entityAddresses[$uuid] = $this->federationClient?->getEntityRecord($uuid)->getAddress();
            }
            catch (Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load dashboard entity label', $exception);
                return $this->entityAddresses[$uuid] = null;
            }
        }

    /**
     * Calculate the total number of tracked records displayed in the dashboard status card.
     *
     * @return int Total audit log, blacklist, entity, evidence, and attachment record count.
     */
    public function getTrackedRecordTotal(): int
    {
        return $this->serverInformation->getAuditLogRecords()
            + $this->serverInformation->getBlacklistRecords()
            + $this->serverInformation->getKnownEntities()
            + $this->serverInformation->getEvidenceRecords()
            + $this->serverInformation->getFileAttachmentRecords();
    }

        /**
         * Calculate the total number of records represented on the dashboard.
         *
         * @return int Total record count.
         */
        private function getRecordTotal(): int
        {
            return $this->serverInformation->getAuditLogRecords()
                + $this->serverInformation->getBlacklistRecords()
                + $this->serverInformation->getEvidenceRecords()
                + $this->serverInformation->getFileAttachmentRecords()
                + $this->serverInformation->getKnownEntities()
                + $this->serverInformation->getOperators()
                + $this->serverInformation->getReports();
        }

        /**
         * Calculate a record count as a percentage of all dashboard records.
         *
         * @param int $recordCount Record count to express as a percentage.
         * @return int Rounded percentage of the total record count.
         */
        public function getRecordPercentage(int $recordCount): int
        {
            $total = $this->getRecordTotal();
            return $total > 0 ? round(($recordCount / $total) * 100) : 0;
        }

        /**
         * Format a Unix timestamp for display.
         *
         * @param int $timestamp Unix timestamp to format.
         * @param string $format PHP date format to apply.
         * @return string Formatted date, or an em dash for a non-positive timestamp.
         */
        public function formatDate(int $timestamp, string $format = 'Y-m-d H:i:s'): string
        {
            return $timestamp > 0 ? date($format, $timestamp) : '—';
        }

        /**
         * Determine the badge color for an audit log type.
         *
         * @param AuditLogType $type Audit log type to classify.
         * @return string Badge color name.
         */
        public function getAuditLogBadgeColor(AuditLogType $type): string
        {
            return match ($type)
            {
                AuditLogType::OPERATOR_DELETED,
                AuditLogType::ATTACHMENT_DELETED,
                AuditLogType::EVIDENCE_DELETED,
                AuditLogType::REPORT_DELETED,
                AuditLogType::ENTITY_DELETED,
                AuditLogType::BLACKLIST_RECORD_DELETED,
                AuditLogType::OPERATOR_DISABLED => 'red',
                AuditLogType::OPERATOR_PERMISSIONS_CHANGED,

                AuditLogType::ENTITY_BLACKLISTED => 'amber',

                default => match ($type->getCategory())
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
         * Determine the timeline CSS class for an audit log type.
         *
         * @param AuditLogType $type Audit log type to classify.
         * @return string Timeline CSS class.
         */
        public function getTimelineClass(AuditLogType $type): string
        {
            return match ($type)
            {
                AuditLogType::OPERATOR_DELETED,
                AuditLogType::ATTACHMENT_DELETED,
                AuditLogType::EVIDENCE_DELETED,
                AuditLogType::REPORT_DELETED,
                AuditLogType::ENTITY_DELETED,
                AuditLogType::BLACKLIST_RECORD_DELETED,
                AuditLogType::OPERATOR_DISABLED,
                AuditLogType::ENTITY_BLACKLISTED => 'danger',

                AuditLogType::OPERATOR_CREATED,
                AuditLogType::OPERATOR_ENABLED,
                AuditLogType::BLACKLIST_LIFTED => 'success',

                AuditLogType::OPERATOR_PERMISSIONS_CHANGED,
                AuditLogType::OPERATOR_NAME_CHANGED,
                AuditLogType::OPERATOR_AUTO_ASSIGN_CHANGED,
                AuditLogType::ENTITY_WHITELIST_CHANGED => 'warning',

                default => 'active',
            };
        }
    }
