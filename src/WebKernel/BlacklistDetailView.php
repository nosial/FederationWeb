<?php

    namespace WebKernel;

    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use FederationLib\Enums\ClassificationFlag;
    use FederationLib\Enums\IncidentType;
    use FederationLib\FederationClient;

    /**
     * Provides data, formatting, and actions for a blacklist record detail page.
     */
    class BlacklistDetailView
    {
        private mixed $record = null;
        private bool $error = false;
        private mixed $entityRecord = null;
        private mixed $operatorRecord = null;
        private mixed $reportRecord = null;
        private ?array $reportEvidence = [];
        private array $evidenceAttachments = [];
        private ?array $auditLogs = [];
        private ?array $entityBlacklistRecords = null;
        private ?array $entityEvidenceRecords = null;
        private ?array $entityReports = null;
        private array $operatorNames = [];
        private array $entityAddresses = [];
        private string $typeBadge = 'fw-badge-gray';
        private ?int $expires = null;
        private ?int $remaining = null;
        private int $totalDuration = 0;
        private int $elapsed = 0;
        private float|int $expirationPercentage = 0;
        private bool $darkMode;
        private ?string $successMessage;
        private ?string $errorMessage;
        private ?string $errorDetail;

        private FederationClient $federationClient;

        /**
         * BlacklistDetailView constructor.
         */
        public function __construct()
        {
            $this->federationClient = WebSession::get('federation_client');
            $this->darkMode = Utilities::getDarkMode();
            $statusMessages = Utilities::getStatusMessages();
            $this->successMessage = $statusMessages->successMessageKey;
            $this->errorMessage = $statusMessages->errorMessageKey;
            $this->errorDetail = $statusMessages->errorDetail;

            try
            {
                $this->record = $this->federationClient->getBlacklistRecord(WebSession::getRequest()->getPathParameter('blacklist_uuid'));
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load blacklist record', $exception);
                $this->error = true;
                return;
            }

            if($this->record === null) return;

            if (ViewAuthorization::canReadEntities()) try { $this->entityRecord = $this->federationClient->getEntityRecord($this->record->getEntityUuid()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load blacklist entity', $exception); }
            if (ViewAuthorization::canReadOperatorRecords()) try { $this->operatorRecord = $this->federationClient->getOperator($this->record->getOperatorUuid()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load blacklist operator', $exception); }
            if (ViewAuthorization::canReadReports() && ($reportUuid = $this->record->getReportUuid()) !== null && $reportUuid !== '') { try { $this->reportRecord = Utilities::getReport($this->federationClient, $reportUuid); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load blacklist report record', $exception); } }
            if ($this->reportRecord !== null)
            {
                if (ViewAuthorization::canReadEvidence()) try { $this->reportEvidence = $this->federationClient->listReportEvidenceRecords($this->reportRecord->getUuid(), includeConfidential: ViewAuthorization::canManageRecords()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load blacklist report evidence', $exception); $this->reportEvidence = null; }
                else $this->reportEvidence = [];
                if (ViewAuthorization::canManageRecords())
                {
                    foreach($this->reportEvidence ?? [] as $evidenceRecord)
                    {
                        try { $this->evidenceAttachments[$evidenceRecord->getUuid()] = $this->federationClient->getEvidenceAttachments($evidenceRecord->getUuid()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load blacklist report evidence attachments', $exception); $this->evidenceAttachments[$evidenceRecord->getUuid()] = []; }
                    }
                }
            }
            else $this->reportEvidence = [];
            if (ViewAuthorization::canReadAuditLogs())
            {
                $this->auditLogs = Utilities::collectAuditLogs(
                    [fn(int $page): array => $this->federationClient->listEntityAuditLogs($this->record->getEntityUuid(), $page, 100)],
                    fn($log): bool => $log->getBlacklistUuid() === $this->record->getUuid()
                );
            }
            else
            {
                $this->auditLogs = [];
            }

            $entityUuid = $this->record->getEntityUuid();
            if (ViewAuthorization::canReadBlacklist()) try { $this->entityBlacklistRecords = array_values(array_filter($this->federationClient->listEntityBlacklistRecords($entityUuid, 1, 100, includeLifted: true), fn($blacklistRecord) => $blacklistRecord->getUuid() !== $this->record->getUuid())); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load blacklist entity blacklist records', $exception); }
            else $this->entityBlacklistRecords = [];
            if (ViewAuthorization::canReadEvidence()) try { $this->entityEvidenceRecords = $this->federationClient->listEntityEvidenceRecords($entityUuid, 1, 100, ViewAuthorization::canManageRecords()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load blacklist entity evidence records', $exception); }
            else $this->entityEvidenceRecords = [];
            if (ViewAuthorization::canReadReports()) try { $this->entityReports = $this->federationClient->listEntityReports($entityUuid); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load blacklist entity reports', $exception); }
            else $this->entityReports = [];

            $operatorUuids = [$this->record->getOperatorUuid() => true];
            $entityUuids = [];
            foreach($this->auditLogs ?? [] as $log)
            {
                if($log->getOperatorUuid() !== null) $operatorUuids[$log->getOperatorUuid()] = true;
                if($log->getEntityUuid() !== null) $entityUuids[$log->getEntityUuid()] = true;
            }
            foreach($this->entityBlacklistRecords ?? [] as $blacklistRecord) $operatorUuids[$blacklistRecord->getOperatorUuid()] = true;
            foreach($this->entityEvidenceRecords ?? [] as $evidenceRecord) $operatorUuids[$evidenceRecord->getOperatorUuid()] = true;
            foreach($this->entityReports ?? [] as $report)
            {
                $operatorUuids[$report->getSubmittingOperator()] = true;
                if($report->getAssignedOperator() !== null) $operatorUuids[$report->getAssignedOperator()] = true;
            }
            if($this->reportRecord !== null) { $operatorUuids[$this->reportRecord->getSubmittingOperator()] = true; if($this->reportRecord->getAssignedOperator() !== null) $operatorUuids[$this->reportRecord->getAssignedOperator()] = true; if($this->reportRecord->getReportingEntity() !== null) $entityUuids[$this->reportRecord->getReportingEntity()] = true; }
            foreach($this->reportEvidence ?? [] as $evidenceRecord) { $operatorUuids[$evidenceRecord->getOperatorUuid()] = true; $entityUuids[$evidenceRecord->getEntityUuid()] = true; }
            $typeValue = $this->record->getType()->value;
            $this->expires = $this->record->getExpires();
            $now = time();
            $this->totalDuration = $this->record->getCreated() > 0 && $this->expires !== null ? $this->expires - $this->record->getCreated() : 0;
            $this->elapsed = $this->record->getCreated() > 0 && $this->expires !== null ? $now - $this->record->getCreated() : 0;
            $this->operatorNames = $this->loadOperatorNames(array_keys($operatorUuids));
            $this->entityAddresses = $this->loadEntityAddresses(array_keys($entityUuids));
            $this->typeBadge = match($typeValue) { 'SPAM', 'SCAM' => 'fw-badge-amber', 'MALWARE', 'ILLEGAL_CONTENT' => 'fw-badge-red', 'PHISHING' => 'fw-badge-blue', 'SERVICE_ABUSE' => 'fw-badge-purple', default => 'fw-badge-gray' };
            $this->remaining = $this->expires !== null ? $this->expires - $now : null;
            $this->expirationPercentage = $this->totalDuration > 0 ? min(100, max(0, ($this->elapsed / $this->totalDuration) * 100)) : 0;
        }

        /** Returns the loaded blacklist record.
         * @return mixed The blacklist record.
         */
        public function getRecord(): mixed { return $this->record; }
        /** Determines whether loading the blacklist record failed.
         * @return bool Whether an error occurred.
         */
        public function hasError(): bool { return $this->error; }
        /** Returns the blacklisted entity.
         * @return mixed The entity record.
         */
        public function getEntityRecord(): mixed { return $this->entityRecord; }
        /** Returns the operator that created the blacklist record.
         * @return mixed The operator record.
         */
        public function getOperatorRecord(): mixed { return $this->operatorRecord; }
        /** Returns the report supporting the blacklist record.
         * @return mixed The report record.
         */
        public function getReportRecord(): mixed { return $this->reportRecord; }
        /** Returns the evidence records attached to the supporting report.
         * @return array|null The evidence records, or null when loading failed.
         */
        public function getReportEvidence(): ?array { return $this->reportEvidence; }
        /** Returns report evidence attachments keyed by evidence UUID.
         * @return array The evidence attachments.
         */
        public function getEvidenceAttachments(): array { return $this->evidenceAttachments; }
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
        /** Returns audit logs associated with the blacklist record.
         * @return array|null The associated audit logs, or null when loading failed.
         */
        public function getAuditLogs(): ?array { return $this->auditLogs; }
        /** Returns the other blacklist records of the blacklisted entity.
         * @return array|null The blacklist records, or null when loading failed.
         */
        public function getEntityBlacklistRecords(): ?array { return $this->entityBlacklistRecords; }
        /** Returns the evidence records of the blacklisted entity.
         * @return array|null The evidence records, or null when loading failed.
         */
        public function getEntityEvidenceRecords(): ?array { return $this->entityEvidenceRecords; }
        /** Returns the reports of the blacklisted entity.
         * @return array|null The reports, or null when loading failed.
         */
        public function getEntityReports(): ?array { return $this->entityReports; }
        /** Returns operator labels keyed by UUID.
         * @return array The operator labels.
         */
        public function getOperatorNames(): array { return $this->operatorNames; }
        /** Returns entity addresses keyed by UUID.
         * @return array The entity addresses.
         */
        public function getEntityAddresses(): array { return $this->entityAddresses; }
        /** Returns the blacklist type badge CSS class.
         * @return string The badge CSS class.
         */
        public function getTypeBadge(): string { return $this->typeBadge; }
        /** Returns the badge CSS class for an incident type.
         * @param IncidentType $type The incident type.
         * @return string The badge CSS class.
         */
        public function getIncidentTypeBadge(IncidentType $type): string
        {
            return match($type->value)
            {
                'SPAM', 'SCAM' => 'fw-badge-amber',
                'MALWARE', 'ILLEGAL_CONTENT' => 'fw-badge-red',
                'PHISHING' => 'fw-badge-blue',
                'SERVICE_ABUSE' => 'fw-badge-purple',
                default => 'fw-badge-gray',
            };
        }
        /** Returns the badge CSS class for an evidence classification flag.
         * @param ClassificationFlag|null $flag The classification flag, if any.
         * @return string The badge CSS class.
         */
        public function getClassificationBadge(?ClassificationFlag $flag): string
        {
            return match($flag?->value)
            {
                'SUSPICIOUS' => 'fw-badge-cyan',
                'MALICIOUS' => 'fw-badge-red',
                'SCAM_INDICATOR' => 'fw-badge-amber',
                'BENIGN' => 'fw-badge-green',
                default => 'fw-badge-gray',
            };
        }
        /** Returns the blacklist expiration timestamp.
         * @return int|null The expiration timestamp, if set.
         */
        public function getExpires(): ?int { return $this->expires; }
        /** Returns the remaining blacklist duration in seconds.
         * @return int|null The remaining duration, if the record expires.
         */
        public function getRemaining(): ?int { return $this->remaining; }
        /** Returns the total blacklist duration in seconds.
         * @return int The total duration.
         */
        public function getTotalDuration(): int { return $this->totalDuration; }
        /** Returns the elapsed blacklist duration in seconds.
         * @return int The elapsed duration.
         */
        public function getElapsed(): int { return $this->elapsed; }
        /** Returns the elapsed percentage of the blacklist duration.
         * @return float|int The elapsed percentage.
         */
        public function getExpirationPercentage(): float|int { return $this->expirationPercentage; }
        /**
         * Formats a remaining duration for display.
         *
         * @param int|null $seconds The remaining duration in seconds.
         * @return string|null The formatted duration, or null for no expiration.
         */
        public function formatRemaining(?int $seconds): ?string
        {
            if($seconds === null) return null;
            if($seconds <= 0) return Utilities::localize('expired');
            $days = intdiv($seconds, 86400);
            $hours = intdiv($seconds % 86400, 3600);
            $minutes = intdiv($seconds % 3600, 60);
            $parts = [];
            if($days > 0) $parts[] = $days . 'd';
            if($hours > 0) $parts[] = $hours . 'h';
            if($minutes > 0) $parts[] = $minutes . 'm';
            if($parts === []) $parts[] = $seconds . 's';
            return implode(' ', $parts);
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
        public function getSuccessMessage(): ?string { return $this->successMessage; }
        /** Returns the current error status message.
         * @return string|null The error message, if present.
         */
        public function getErrorMessage(): ?string { return $this->errorMessage; }
        /** Returns the detailed error status message.
         * @return string|null The error detail, if present.
         */
        public function getErrorDetail(): ?string { return $this->errorDetail; }

        /**
         * Returns the summary of the blacklist record shown in search results and link previews.
         *
         * @return string|null The summary, or null when the record could not be loaded.
         */
        public function getPageDescription(): ?string
        {
            if ($this->record === null)
            {
                return null;
            }

            if ($this->record->isLifted())
            {
                $status = 'status_lifted';
            }
            elseif ($this->record->getExpires() !== null && $this->record->getExpires() <= time())
            {
                $status = 'expired';
            }
            else
            {
                $status = 'status_active';
            }

            return Utilities::localize('meta_description_record', [
                'entity' => $this->entityRecord?->getAddress() ?? $this->record->getEntityUuid(),
                'server_name' => PageMetadata::getSiteName(),
                'incident_type' => Utilities::localize('incident_' . strtolower($this->record->getType()->value)),
                'created' => Utilities::formatDate($this->record->getCreated(), 'Y-m-d'),
                'status' => Utilities::localize($status),
            ]);
        }

        /**
         * Processes the submitted blacklist action and redirects to its result.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest();
            $action = $request->getParameter('action');
            $redirect = ['blacklist_uuid' => $this->record->getUuid()];
            try
            {
                switch($action)
                {
                    case 'lift_blacklist': $this->federationClient->liftBlacklistRecord($this->record->getUuid()); $redirect['success'] = 'blacklist_lifted'; break;
                    case 'extend_blacklist':
                        $expires = $request->getParameter('extend_expires');
                        if(!ctype_digit((string)$expires)) throw new \Exception('Expiration must be a Unix timestamp');
                        $seconds = (int)$expires - (int)$this->record->getExpires();
                        if($seconds <= 0) throw new \Exception('New expiration must be after the current expiration');
                        $this->federationClient->extendBlacklistRecord($this->record->getUuid(), $seconds);
                        $redirect['success'] = 'blacklist_extended';
                        break;
                    case 'delete_blacklist': $this->federationClient->deleteBlacklistRecord($this->record->getUuid()); Utilities::redirect('blacklist', queryParameters: ['success' => 'blacklist_deleted']);
                }
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to process blacklist action', $exception);
                $redirect['error'] = match($action) { 'lift_blacklist' => 'blacklist_lift_failed', 'extend_blacklist' => 'blacklist_extend_failed', 'delete_blacklist' => 'blacklist_delete_failed', default => $action . '_failed' };
                $redirect['error_message'] = $exception->getMessage();
            }
            Utilities::redirect('blacklist_detail', ['blacklist_uuid' => $this->record->getUuid()], $redirect);
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
