<?php

    namespace WebKernel;

    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\WebSession;
    use FederationLib\Enums\AuditLogType;
    use FederationLib\Enums\EntityRelationshipType;
    use FederationLib\Enums\IncidentType;
    use FederationLib\FederationClient;
    use FederationLib\Objects\EntityQueryResult;
    use FederationLib\Objects\OperatorRecord;

    /**
     * Provides data, formatting, and actions for an entity detail page.
     */
    class EntityDetailView
    {
        private mixed $entity = null;
        private bool $error = false;
        private ?string $queryErrorDetail = null;
        private array $recentReports = [];
        private array $recentEvidence = [];
        private array $recentBlacklist = [];
        private array $recentAuditLogs = [];
        private array $operatorNames = [];
        private array $entityAddresses = [];
        private bool $darkMode = true;
        private ?string $successMsg = null;
        private ?string $errorMsg = null;
        private ?string $errorMessage = null;
        private mixed $relationshipEntity = null;
        private ?EntityQueryResult $queryResult = null;
        private ?string $primaryOperatorUuid = null;
        private int $primaryOperatorRecords = 0;
        private ?OperatorRecord $primaryOperator = null;
        private bool $primaryOperatorLoaded = false;
        private ?array $reportEvidenceCounts = null;
        private ?array $reportAttachmentCounts = null;

        private FederationClient $federationClient;

        /**
         * EntityDetailView constructor.
         */
        public function __construct()
        {
            $this->federationClient = WebSession::get('federation_client');
            $this->darkMode = Utilities::getDarkMode();
            $statusMessages = Utilities::getStatusMessages();
            $this->successMsg = $statusMessages->successMessageKey;
            $this->errorMsg = $statusMessages->errorMessageKey;
            $this->errorMessage = $statusMessages->errorDetail;

            $identifier = trim((string)(WebSession::getRequest()->getPathParameter('entity_id')
                ?? WebSession::getRequest()->getParameter('identifier')));
            try
            {
                $this->queryResult = $this->federationClient->queryEntity($identifier);
                $this->entity = $this->queryResult->getEntityRecord();
            }
            catch(\Throwable $exception)
            {
                Logger::getLogger()->warning('Unable to query entity', $exception);
                $this->queryErrorDetail = $exception->getMessage();
                $this->error = true;
                return;
            }

            if($this->entity === null) return;

            if (ViewAuthorization::canReadReports()) try { $this->recentReports = $this->federationClient->listEntityReports($this->entity->getUuid()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load entity reports', $exception); }
            else $this->recentReports = [];
            if (ViewAuthorization::canReadEvidence()) try { $this->recentEvidence = $this->federationClient->listEntityEvidenceRecords($this->entity->getUuid(), includeConfidential: ViewAuthorization::canManageRecords()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load entity evidence', $exception); }
            else $this->recentEvidence = [];
            if (ViewAuthorization::canReadBlacklist()) try { $this->recentBlacklist = $this->federationClient->listEntityBlacklistRecords($this->entity->getUuid(), includeLifted: true); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load entity blacklist records', $exception); }
            else $this->recentBlacklist = [];
            if (ViewAuthorization::canReadAuditLogs()) try { $this->recentAuditLogs = $this->federationClient->listEntityAuditLogs($this->entity->getUuid()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load entity audit logs', $exception); }
            else $this->recentAuditLogs = [];

            $relationshipUuid = $this->entity->getRelationshipEntity();
            if(ViewAuthorization::canReadEntities() && $relationshipUuid !== null)
            {
                try { $this->relationshipEntity = $this->federationClient->getEntityRecord($relationshipUuid); }
                catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load related entity', $exception); }
            }

            $operatorUuids = [];
            $entityUuids = [];
            foreach($this->recentReports as $report)
            {
                $operatorUuids[$report->getSubmittingOperator()] = ($operatorUuids[$report->getSubmittingOperator()] ?? 0) + 1;
                if($report->getAssignedOperator() !== null) $operatorUuids[$report->getAssignedOperator()] = ($operatorUuids[$report->getAssignedOperator()] ?? 0) + 1;
            }
            foreach($this->recentEvidence as $evidence) $operatorUuids[$evidence->getOperatorUuid()] = ($operatorUuids[$evidence->getOperatorUuid()] ?? 0) + 1;
            foreach($this->recentBlacklist as $blacklist) $operatorUuids[$blacklist->getOperatorUuid()] = ($operatorUuids[$blacklist->getOperatorUuid()] ?? 0) + 1;
            foreach($this->recentAuditLogs as $log)
            {
                if($log->getOperatorUuid() !== null) $operatorUuids[$log->getOperatorUuid()] = ($operatorUuids[$log->getOperatorUuid()] ?? 0) + 1;
                if($log->getEntityUuid() !== null) $entityUuids[$log->getEntityUuid()] = true;
            }
            $this->operatorNames = $this->loadOperatorNames(array_keys($operatorUuids));
            $this->entityAddresses = $this->loadEntityAddresses(array_keys($entityUuids));

            if(!empty($operatorUuids))
            {
                arsort($operatorUuids);
                $this->primaryOperatorUuid = (string)array_key_first($operatorUuids);
                $this->primaryOperatorRecords = $operatorUuids[$this->primaryOperatorUuid];
            }
        }

        /** Returns the loaded entity record.
         * @return mixed The entity record.
         */
        public function getEntity(): mixed { return $this->entity; }
        /** Determines whether loading the entity failed.
         * @return bool Whether an error occurred.
         */
        public function hasError(): bool { return $this->error; }
        /** Returns the relationship-group query result for this entity. */
        public function getQueryResult(): ?EntityQueryResult { return $this->queryResult; }
        /** Returns the query failure detail, when the entity query failed. */
        public function getQueryErrorDetail(): ?string { return $this->queryErrorDetail; }
        /** Resolves an entity UUID within the current query relationship group. */
        public function getQueryEntityAddress(string $entityUuid): string
        {
            if($this->queryResult === null) return $entityUuid;
            $entity = $this->queryResult->getEntityRecord();
            if($entity->getUuid() === $entityUuid) return $entity->getAddress();
            foreach($this->queryResult->getRelatedEntities() as $relatedEntity)
            {
                if($relatedEntity->getUuid() === $entityUuid) return $relatedEntity->getAddress();
            }
            return $entityUuid;
        }
        /** Returns recent reports for the entity.
         * @return array The recent reports.
         */
        public function getRecentReports(): array { return $this->recentReports; }
        /** Returns recent evidence records for the entity.
         * @return array The recent evidence records.
         */
        public function getRecentEvidence(): array { return $this->recentEvidence; }
        /** Returns recent blacklist records for the entity.
         * @return array The recent blacklist records.
         */
        public function getRecentBlacklist(): array { return $this->recentBlacklist; }
        /** Returns recent audit logs for the entity.
         * @return array The recent audit logs.
         */
        public function getRecentAuditLogs(): array { return $this->recentAuditLogs; }
        /** Returns operator labels keyed by UUID.
         * @return array The operator labels.
         */
        public function getOperatorNames(): array { return $this->operatorNames; }
        /** Returns entity addresses keyed by UUID.
         * @return array The entity addresses.
         */
        public function getEntityAddresses(): array { return $this->entityAddresses; }
        /**
         * Formats a Unix timestamp for display.
         *
         * @param int $timestamp The Unix timestamp to format.
         * @param string $format The PHP date format to apply.
         * @return string The formatted date.
         */
        public function formatDate(int $timestamp, string $format='Y-m-d H:i:s'): string { return Utilities::formatDate($timestamp, $format); }
        /** Determines whether the page uses dark mode.
         * @return bool Whether dark mode is enabled.
         */
        public function isDarkMode(): bool { return $this->darkMode; }
        /** Returns the current success status message.
         * @return string|null The success message, if present.
         */
        public function getSuccessMessage(): ?string { return $this->successMsg; }
        /** Returns the current error status message.
         * @return string|null The error message, if present.
         */
        public function getErrorMessage(): ?string { return $this->errorMsg; }
        /** Returns the detailed error status message.
         * @return string|null The error detail, if present.
         */
        public function getErrorDetail(): ?string { return $this->errorMessage; }
        /** Returns the entity related through the configured relationship.
         * @return mixed The related entity record.
         */
        public function getRelationshipEntity(): mixed { return $this->relationshipEntity; }
        /** Returns the UUID of the operator most involved with this entity.
         * @return string|null The operator UUID, or null when no operator is linked to this entity.
         */
        public function getPrimaryOperatorUuid(): ?string { return $this->primaryOperatorUuid; }
        /** Returns how many entity records reference the most involved operator.
         * @return int The number of referencing records.
         */
        public function getPrimaryOperatorRecordCount(): int { return $this->primaryOperatorRecords; }
        /**
         * Returns the record of the operator most involved with this entity.
         *
         * @return OperatorRecord|null The operator record, or null when absent or unavailable.
         */
        public function getPrimaryOperator(): ?OperatorRecord
        {
            if($this->primaryOperatorLoaded || $this->primaryOperatorUuid === null) return $this->primaryOperator;
            $this->primaryOperatorLoaded = true;
            if (ViewAuthorization::canReadOperatorRecords())
            {
                try { $this->primaryOperator = $this->federationClient->getOperator($this->primaryOperatorUuid); }
                catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load the primary entity operator', $exception); }
            }
            return $this->primaryOperator;
        }
        /**
         * Returns the number of entity evidence records linked to each entity report.
         *
         * @return array Evidence counts keyed by report UUID.
         */
        public function getReportEvidenceCounts(): array
        {
            if($this->reportEvidenceCounts !== null) return $this->reportEvidenceCounts;
            $counts = [];
            foreach($this->recentReports as $report) $counts[$report->getUuid()] = 0;
            foreach($this->recentEvidence as $evidence)
            {
                $reportUuid = $evidence->getReport();
                if($reportUuid === null) continue;
                $counts[$reportUuid] = ($counts[$reportUuid] ?? 0) + 1;
            }
            return $this->reportEvidenceCounts = $counts;
        }
        /**
         * Returns the number of file attachments linked to each entity report through its evidence.
         *
         * @return array|null Attachment counts keyed by report UUID, or null when loading failed.
         */
        public function getReportAttachmentCounts(): ?array
        {
            if($this->reportAttachmentCounts !== null) return $this->reportAttachmentCounts;
            $counts = [];
            foreach($this->recentReports as $report) $counts[$report->getUuid()] = 0;
            foreach($this->recentEvidence as $evidence)
            {
                $reportUuid = $evidence->getReport();
                if($reportUuid === null) continue;
                try { $counts[$reportUuid] = ($counts[$reportUuid] ?? 0) + count($this->federationClient->getEvidenceAttachments($evidence->getUuid())); }
                catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load entity evidence attachments', $exception); return null; }
            }
            return $this->reportAttachmentCounts = $counts;
        }
        /**
         * Returns the badge CSS class for an audit log type.
         *
         * @param AuditLogType $type The audit log type to classify.
         * @return string The badge CSS class.
         */
        public function getAuditLogBadgeColor(AuditLogType $type): string
        {
            return match($type->getCategory()->name) { 'OPERATOR_EVENTS', 'ENTITY_EVENTS' => 'fw-badge-blue', 'ATTACHMENT_EVENTS' => 'fw-badge-purple', 'EVIDENCE_EVENTS' => 'fw-badge-amber', 'REPORT_EVENTS' => 'fw-badge-gray', 'BLACKLIST_EVENTS' => 'fw-badge-red', default => 'fw-badge-gray' };
        }

        /**
         * Processes the submitted entity action and redirects to its result.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest();
            $action = $request->getParameter('action');
            $redirect = ['entity_id' => $this->entity->getUuid()];
            try
            {
                switch($action)
                {
                    case 'toggle_whitelist':
                        $this->federationClient->setEntityWhitelist($this->entity->getUuid(), !$this->entity->isWhitelisted());
                        $redirect['success'] = $this->entity->isWhitelisted() ? 'entity_unwhitelisted' : 'entity_whitelisted';
                        break;
                    case 'edit_entity':
                        $host = $request->getParameter('entity_host');
                        if(empty($host)) throw new \Exception('Host is required');
                        $metadataRaw = $request->getParameter('entity_metadata');
                        $metadata = null;
                        if($metadataRaw !== null)
                        {
                            if($metadataRaw === '' || $metadataRaw === '{}') $metadata = [];
                            else
                            {
                                $metadata = @json_decode($metadataRaw, true);
                                if(!is_array($metadata)) throw new \Exception('Invalid metadata');
                            }
                        }
                        $this->federationClient->updateEntity($this->entity->getUuid(), $metadata);
                        $redirect['success'] = 'entity_updated';
                        break;
                    case 'delete_entity':
                        $this->federationClient->deleteEntity($this->entity->getUuid());
                        Utilities::redirect('entities', queryParameters: ['success' => 'entity_deleted']);
                    case 'submit_evidence':
                        $this->federationClient->submitEvidence($this->entity->getUuid(), $request->getParameter('evidence_text') ?: null, $request->getParameter('evidence_note') ?: null, $request->getParameter('evidence_tag') ?: null, $request->getParameter('evidence_confidential') === '1');
                        $redirect['success'] = 'evidence_submitted';
                        break;
                    case 'blacklist_entity':
                        $reportUuid = $request->getParameter('blacklist_report_uuid');
                        if(empty($reportUuid)) throw new \Exception('Report UUID is required');
                        $type = IncidentType::tryFrom($request->getParameter('blacklist_type'));
                        if($type === null) throw new \Exception('Invalid incident type');
                        $expires = $request->getParameter('blacklist_expires');
                        if($expires === '' || $expires === null)
                        {
                            $expires = null;
                        }
                        elseif(!ctype_digit((string)$expires) || (int)$expires <= time())
                        {
                            throw new \Exception('Blacklist expiration must be a future Unix timestamp');
                        }
                        else
                        {
                            $expires = (int)$expires;
                        }
                        $this->federationClient->blacklistEntity($this->entity->getUuid(), $reportUuid, $type, $expires);
                        $redirect['success'] = 'entity_blacklisted';
                        break;
                    case 'set_relationship':
                        $targetUuid = $request->getParameter('relationship_target_uuid');
                        if(empty($targetUuid)) throw new \Exception('Target entity UUID is required');
                        $type = EntityRelationshipType::tryFrom(strtoupper($request->getParameter('relationship_type')));
                        if($type === null) throw new \Exception('Invalid relationship type');
                        $this->federationClient->setEntityRelationship($this->entity->getUuid(), $targetUuid, $type);
                        $redirect['success'] = 'relationship_set';
                        break;
                    case 'clear_relationship': $this->federationClient->clearEntityRelationship($this->entity->getUuid()); $redirect['success'] = 'relationship_cleared'; break;
                    case 'clear_reputation': $this->federationClient->clearEntityReputation($this->entity->getUuid()); $redirect['success'] = 'reputation_cleared'; break;
                }
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to process entity action', $exception);
                $redirect['error'] = match ($action)
                {
                    'toggle_whitelist' => 'entity_whitelist_failed', 'edit_entity' => 'entity_updated_failed', 'delete_entity' => 'entity_delete_failed',
                    'submit_evidence' => 'evidence_submit_failed', 'blacklist_entity' => 'entity_blacklist_failed', 'set_relationship' => 'relationship_set_failed',
                    'clear_relationship' => 'relationship_clear_failed', 'clear_reputation' => 'reputation_clear_failed', default => $action . '_failed',
                };
                $redirect['error_message'] = $exception->getMessage();
            }
            Utilities::redirect('entity_detail', ['entity_id' => $this->entity->getUuid()], $redirect);
        }

        /**
         * Loads operator names for the supplied UUIDs.
         *
         * @param array $uuids The operator UUIDs to resolve.
         * @return array Operator names keyed by UUID.
         */
        private function loadOperatorNames(array $uuids): array
        {
            return Utilities::getOperatorNames($this->federationClient, $uuids);
        }

        /**
         * Loads entity addresses for the supplied UUIDs.
         *
         * @param array $uuids The entity UUIDs to resolve.
         * @return array Entity addresses keyed by UUID.
         */
        private function loadEntityAddresses(array $uuids): array
        {
            return Utilities::getEntityAddresses($this->federationClient, $uuids);
        }
    }
