<?php

    namespace WebKernel;

    use DynamicalWeb\Enums\RequestMethod;
    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\WebSession;
    use FederationLib\Enums\AuditLogType;
    use FederationLib\Enums\Categories\AuditLogCategory;
    use FederationLib\Enums\ClassificationFlag;
    use FederationLib\Enums\IncidentType;
    use FederationLib\FederationClient;

    /**
     * Provides data, formatting, and actions for a report detail page.
     */
    class ReportDetailView
    {
        private mixed $report = null;
        private bool $error = false;
        private mixed $submittingOperator = null;
        private mixed $reportingEntity = null;
        private mixed $assignedOperator = null;
        private ?array $relatedEvidence = null;
        private ?array $entityBlacklist = null;
        private ?array $entityReports = null;
        private ?array $auditLogs = null;
        private array $operators = [];
        private array $evidenceAttachments = [];
        private array $operatorNames = [];
        private array $entityAddresses = [];
        private mixed $incidentType = null;
        private string $typeSeverity = 'fw-badge-blue';
        private bool $darkMode = false;
        private ?string $successMsg = null;
        private ?string $errorMsg = null;
        private ?string $errorMessage = null;

        private FederationClient $federationClient;

        /**
         * ReportDetailView constructor.
         */
        public function __construct()
        {
            $this->federationClient = WebSession::get('federation_client');
            $this->darkMode = Utilities::getDarkMode();
            $statusMessages = Utilities::getStatusMessages();
            $this->successMsg = $statusMessages->successMessageKey;
            $this->errorMsg = $statusMessages->errorMessageKey;
            $this->errorMessage = $statusMessages->errorDetail;

            try
            {
                $this->report = Utilities::getReport($this->federationClient, WebSession::getRequest()->getPathParameter('report_uuid'));
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load report', $exception);
                $this->error = true;
                return;
            }

            if (ViewAuthorization::canReadOperatorRecords())
            {
                try { $this->submittingOperator = $this->federationClient->getOperator($this->report->getSubmittingOperator()); }
                catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load report submitting operator', $exception); }
            }
            if(ViewAuthorization::canReadEntities() && ($reportingEntityUuid = $this->report->getReportingEntity()) !== null && $reportingEntityUuid !== '') { try { $this->reportingEntity = $this->federationClient->getEntityRecord($reportingEntityUuid); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load report reporting entity', $exception); } }
            if (ViewAuthorization::canReadOperatorRecords() && ($assignedOperatorUuid = $this->report->getAssignedOperator()) !== null && $assignedOperatorUuid !== '')
            {
                try { $this->assignedOperator = $this->federationClient->getOperator($assignedOperatorUuid); }
                catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load report assigned operator', $exception); }
            }
            if (ViewAuthorization::canReadEvidence()) try { $this->relatedEvidence = $this->federationClient->listReportEvidenceRecords($this->report->getUuid(), includeConfidential: ViewAuthorization::canManageRecords()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load report evidence', $exception); }
            else $this->relatedEvidence = [];
            if($this->reportingEntity !== null)
            {
                if (ViewAuthorization::canReadBlacklist()) try { $this->entityBlacklist = $this->federationClient->listEntityBlacklistRecords($this->reportingEntity->getUuid(), includeLifted: true); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load report entity blacklist', $exception); }
                else $this->entityBlacklist = [];
                if (ViewAuthorization::canReadReports()) try { $this->entityReports = array_values(array_filter($this->federationClient->listEntityReports($this->reportingEntity->getUuid()), fn($entityReport): bool => $entityReport->getUuid() !== $this->report->getUuid())); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load report entity reports', $exception); }
                else $this->entityReports = [];
            }
            else
            {
                $this->entityBlacklist = [];
                $this->entityReports = [];
            }
            if (ViewAuthorization::canReadAuditLogs()) $this->auditLogs = $this->loadAuditLogs();
            else $this->auditLogs = [];
            if (ViewAuthorization::canManageRecords())
            {
                foreach($this->relatedEvidence ?? [] as $evidence)
                {
                    try { $this->evidenceAttachments[$evidence->getUuid()] = $this->federationClient->getEvidenceAttachments($evidence->getUuid()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load evidence attachments', $exception); $this->evidenceAttachments[$evidence->getUuid()] = []; }
                }
            }
            if (ViewAuthorization::canReadOperatorRecords())
            {
                try { $this->operators = $this->federationClient->listOperators(); }
                catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load operators for report', $exception); }
            }

            $operatorUuids = [];
            $entityUuids = [];
            foreach($this->relatedEvidence ?? [] as $evidence) { $operatorUuids[$evidence->getOperatorUuid()] = true; $entityUuids[$evidence->getEntityUuid()] = true; }
            foreach($this->entityBlacklist ?? [] as $blacklist) { $operatorUuids[$blacklist->getOperatorUuid()] = true; $entityUuids[$blacklist->getEntityUuid()] = true; }
            foreach($this->entityReports ?? [] as $entityReport) { $operatorUuids[$entityReport->getSubmittingOperator()] = true; if($entityReport->getAssignedOperator() !== null) { $operatorUuids[$entityReport->getAssignedOperator()] = true; } if($entityReport->getReportingEntity() !== null) { $entityUuids[$entityReport->getReportingEntity()] = true; } }
            foreach($this->auditLogs ?? [] as $auditLog) { if($auditLog->getOperatorUuid() !== null) { $operatorUuids[$auditLog->getOperatorUuid()] = true; } if($auditLog->getEntityUuid() !== null) { $entityUuids[$auditLog->getEntityUuid()] = true; } }
            $this->operatorNames = $this->loadOperatorNames(array_keys($operatorUuids));
            $this->entityAddresses = $this->loadEntityAddresses(array_keys($entityUuids));
            $this->incidentType = $this->report->getIncidentType();
            $this->typeSeverity = $this->getIncidentBadge($this->incidentType);
        }


        /** Returns the loaded report.
         * @return mixed The report record.
         */
        public function getReport(): mixed { return $this->report; }
        /** Determines whether loading the report failed.
         * @return bool Whether an error occurred.
         */
        public function hasError(): bool { return $this->error; }
        /** Returns the operator who submitted the report.
         * @return mixed The submitting operator record.
         */
        public function getSubmittingOperator(): mixed { return $this->submittingOperator; }
        /** Returns the entity that reported the incident.
         * @return mixed The reporting entity record.
         */
        public function getReportingEntity(): mixed { return $this->reportingEntity; }
        /** Returns the operator assigned to the report.
         * @return mixed The assigned operator record.
         */
        public function getAssignedOperator(): mixed { return $this->assignedOperator; }
        /** Returns evidence records related to the report.
         * @return array|null The related evidence records, or null when loading failed.
         */
        public function getRelatedEvidence(): ?array { return $this->relatedEvidence; }
        /** Returns blacklist records for the reporting entity.
         * @return array|null The blacklist records, or null when loading failed.
         */
        public function getEntityBlacklist(): ?array { return $this->entityBlacklist; }
        /** Returns other reports filed against the reporting entity.
         * @return array|null The entity reports, or null when loading failed.
         */
        public function getEntityReports(): ?array { return $this->entityReports; }
        /** Returns audit log entries that reference this report.
         * @return array|null The audit log entries, or null when loading failed.
         */
        public function getAuditLogs(): ?array { return $this->auditLogs; }
        /** Returns available operators.
         * @return array The operators.
         */
        public function getOperators(): array { return $this->operators; }
        /** Returns evidence attachments keyed by evidence UUID.
         * @return array The evidence attachments.
         */
        public function getEvidenceAttachments(): array { return $this->evidenceAttachments; }
        /** Returns operator labels keyed by UUID.
         * @return array The operator labels.
         */
        public function getOperatorNames(): array { return $this->operatorNames; }
        /** Returns entity addresses keyed by UUID.
         * @return array The entity addresses.
         */
        public function getEntityAddresses(): array { return $this->entityAddresses; }
        /** Returns the report incident type.
         * @return mixed The incident type.
         */
        public function getIncidentType(): mixed { return $this->incidentType; }
        /** Returns the incident type badge CSS class.
         * @return string The badge CSS class.
         */
        public function getTypeSeverity(): string { return $this->typeSeverity; }
        /**
         * Returns the badge CSS class for an evidence classification.
         *
         * @param ClassificationFlag|null $classification The evidence classification.
         * @return string The badge CSS class.
         */
        public function getClassificationBadge(?ClassificationFlag $classification): string
        {
            return match($classification)
            {
                ClassificationFlag::MALICIOUS => 'fw-badge-red',
                ClassificationFlag::SUSPICIOUS => 'fw-badge-amber',
                ClassificationFlag::NORMAL => 'fw-badge-green',
                default => 'fw-badge-gray',
            };
        }
        /**
         * Returns the badge CSS class for an incident type.
         *
         * @param IncidentType $incidentType The incident type to classify.
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
         * Returns the badge colour for an audit log type.
         *
         * @param AuditLogType $type The audit log type to classify.
         * @return string The badge colour name.
         */
        public function getAuditLogBadgeColor(AuditLogType $type): string
        {
            return match($type)
            {
                AuditLogType::OPERATOR_DELETED,
                AuditLogType::ATTACHMENT_DELETED,
                AuditLogType::EVIDENCE_DELETED,
                AuditLogType::REPORT_DELETED,
                AuditLogType::ENTITY_DELETED,
                AuditLogType::BLACKLIST_DELETED,
                AuditLogType::OPERATOR_DISABLED => 'red',

                AuditLogType::ENTITY_BLACKLISTED => 'amber',

                default => match($type->getCategory())
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
         * Returns an icon CSS class for a MIME type.
         *
         * @param string $mime The MIME type to classify.
         * @return string The icon CSS class.
         */
        public function getMimeIcon(string $mime): string
        {
            return match(true)
            {
                str_contains($mime, 'pdf') => 'bi-filetype-pdf',
                str_contains($mime, 'image/') => 'bi-file-earmark-image',
                str_contains($mime, 'video/') => 'bi-file-earmark-play',
                str_contains($mime, 'audio/') => 'bi-file-earmark-music',
                str_contains($mime, 'text/') => 'bi-filetype-txt',
                str_contains($mime, 'zip') || str_contains($mime, 'rar') || str_contains($mime, 'tar') || str_contains($mime, 'gzip') => 'bi-file-earmark-zip',
                default => 'bi-file-earmark',
            };
        }
        /**
         * Formats a byte count for display.
         *
         * @param int $bytes The number of bytes to format.
         * @return string The human-readable file size.
         */
        public function formatSize(int $bytes): string
        {
            if($bytes <= 0) return '—';
            if($bytes >= 1073741824) return round($bytes / 1073741824, 1) . ' GB';
            if($bytes >= 1048576) return round($bytes / 1048576, 1) . ' MB';
            if($bytes >= 1024) return round($bytes / 1024, 1) . ' KB';
            return $bytes . ' B';
        }
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

        /**
         * Returns the summary of the report shown in search results and link previews. The report's
         * message is left out, as it can hold details the submitter did not mean to be shown out of context.
         *
         * @return string|null The summary, or null when the report could not be loaded.
         */
        public function getPageDescription(): ?string
        {
            if ($this->report === null)
            {
                return null;
            }

            $parameters = [
                'incident_type' => Utilities::localize('incident_' . strtolower($this->report->getIncidentType()->value)),
                'server_name' => PageMetadata::getSiteName(),
                'created' => Utilities::formatDate($this->report->getCreated(), 'Y-m-d'),
                'status' => Utilities::localize($this->report->isOpened() ? 'open' : 'closed'),
            ];

            if ($this->reportingEntity === null)
            {
                return Utilities::localize('meta_description_record', $parameters);
            }

            return Utilities::localize('meta_description_record_entity', $parameters + ['entity' => $this->reportingEntity->getAddress()]);
        }


        /**
         * Processes the submitted report action and redirects to its result.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest();
            $action = $request->getParameter('action');
            $redirect = ['report_uuid' => $this->report->getUuid()];
            try
            {
                switch($action)
                {
                    case 'close_report':
                        $classification = $request->getParameter('classification');
                        $flag = !empty($classification) ? ClassificationFlag::tryFrom($classification) : null;
                        $operatorUuid = WebSession::getCookieSession('web_session')->get('operator_uuid', '');
                        if(empty($operatorUuid)) { try { $operatorUuid = $this->federationClient->getSelf()->getUuid(); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to determine current operator for report', $exception); } }
                        if(!empty($operatorUuid) && $this->report->isOpened() && $this->report->getAssignedOperator() !== $operatorUuid) { try { $this->federationClient->assignOperatorToReport($this->report->getUuid(), $operatorUuid); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to assign current operator to report', $exception); } }
                        $this->federationClient->closeReport($this->report->getUuid(), $flag);
                        $redirect['success'] = 'report_closed';
                        break;
                    case 'assign_operator':
                        $operatorUuid = $request->getParameter('operator_uuid');
                        if(empty($operatorUuid)) throw new \Exception('Operator UUID is required');
                        $this->federationClient->assignOperatorToReport($this->report->getUuid(), $operatorUuid);
                        $redirect['success'] = 'operator_assigned';
                        break;
                    case 'delete_report':
                        $this->federationClient->deleteReport($this->report->getUuid());
                        Utilities::redirect('reports', queryParameters: ['success' => 'report_deleted']);
                }
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to process report action', $exception);
                $redirect['error'] = match($action) { 'close_report' => 'report_close_failed', 'assign_operator' => 'operator_assign_failed', 'delete_report' => 'report_delete_failed', default => $action . '_failed' };
                $redirect['error_message'] = $exception->getMessage();
            }
            Utilities::redirect('report_detail', ['report_uuid' => $this->report->getUuid()], $redirect);
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
        /**
         * Loads audit log entries that reference the report or its evidence.
         *
         * @return array|null The matching audit log entries, or null when loading failed.
         */
        private function loadAuditLogs(): ?array
        {
            $evidenceUuids = array_map(static fn($evidence): string => $evidence->getUuid(), $this->relatedEvidence ?? []);

            // Report entries carry the reporting entity, except assignments, which only name the
            // assignee; an operator's own log is readable by them or by operator managers.
            $sources = [];
            $reportingEntity = $this->report->getReportingEntity();
            if($reportingEntity !== null)
            {
                $sources[] = fn(int $page): array => $this->federationClient->listEntityAuditLogs($reportingEntity, $page, 100);
            }
            $assignee = $this->report->getAssignedOperator();
            if($assignee !== null && (ViewAuthorization::canReadOperatorRecords() || $assignee === ViewAuthorization::currentOperatorUuid()))
            {
                $sources[] = fn(int $page): array => $this->federationClient->listOperatorAuditLogs($assignee, $page, 100);
            }

            return Utilities::collectAuditLogs($sources, fn($auditLog): bool =>
                str_contains($auditLog->getMessage(), $this->report->getUuid())
                || ($auditLog->getEvidenceUuid() !== null && in_array($auditLog->getEvidenceUuid(), $evidenceUuids, true)));
        }
    }
