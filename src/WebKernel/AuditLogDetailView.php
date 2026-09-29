<?php

    namespace WebKernel;

    use DynamicalWeb\WebSession;
    use DynamicalWeb\Classes\Logger;
    use FederationLib\FederationClient;

    /**
     * Provides data and presentation helpers for an audit log detail page.
     */
    class AuditLogDetailView
    {
        private mixed $record = null;
        private bool $error = false;
        private mixed $operatorRecord = null;
        private mixed $entityRecord = null;
        private mixed $blacklistRecord = null;
        private mixed $evidenceRecord = null;
        private mixed $fileAttachmentRecord = null;
        private bool $fileAttachmentLoaded = false;
        private ?array $operatorAuditLogs = null;
        private bool $operatorAuditLogsLoaded = false;
        private ?array $entityAuditLogs = null;
        private bool $entityAuditLogsLoaded = false;
        /** @var array<string, string|null> Operator names keyed by UUID. */
        private array $operatorNames = [];
        /** @var array<string, string|null> Entity addresses keyed by UUID. */
        private array $entityAddresses = [];
        private mixed $type = null;
        private mixed $category = null;
        private bool $hasRelatedCards = false;
        private bool $darkMode;
        private ?string $successMsg;
        private ?string $errorMsg;
        private ?string $errorMessage;
        private FederationClient $federationClient;

        /**
         * AuditLogDetailView constructor.
         */
        public function __construct()
        {
            $this->federationClient = WebSession::get('federation_client');
            $statusMessages = Utilities::getStatusMessages();
            $this->darkMode = Utilities::getDarkMode();
            $this->successMsg = $statusMessages->successMessageKey;
            $this->errorMsg = $statusMessages->errorMessageKey;
            $this->errorMessage = $statusMessages->errorDetail;

            try { $this->record = $this->federationClient->getAuditLogRecord(WebSession::getRequest()->getPathParameter('audit_log_uuid')); }
            catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load audit log record', $exception); $this->error = true; }

            $operatorRecord = null;
            $entityRecord = null;
            $blacklistRecord = null;
            $evidenceRecord = null;
            if($this->record !== null)
            {
                if(ViewAuthorization::canReadOperatorRecords() && ($operatorUuid = $this->record->getOperatorUuid()) !== null && $operatorUuid !== '') { try { $operatorRecord = $this->federationClient->getOperator($operatorUuid); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load audit log operator', $exception); } }
                if(($entityUuid = $this->record->getEntityUuid()) !== null && $entityUuid !== '') { try { $entityRecord = $this->federationClient->getEntityRecord($entityUuid); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load audit log entity', $exception); } }
                if(($blacklistUuid = $this->record->getBlacklistUuid()) !== null && $blacklistUuid !== '') { try { $blacklistRecord = $this->federationClient->getBlacklistRecord($blacklistUuid); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load audit log blacklist record', $exception); } }
                if(($evidenceUuid = $this->record->getEvidenceUuid()) !== null && $evidenceUuid !== '') { try { $evidenceRecord = Utilities::getEvidence($this->federationClient, $evidenceUuid); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load audit log evidence record', $exception); } }
            }

            $this->operatorRecord = $operatorRecord;
            $this->entityRecord = $entityRecord;
            $this->blacklistRecord = $blacklistRecord;
            $this->evidenceRecord = $evidenceRecord;
            $this->type = $this->record?->getType();
            $this->category = $this->record?->getType()->getCategory();
            $this->hasRelatedCards = $this->record !== null && ($this->record->getOperatorUuid() !== null || $this->record->getEntityUuid() !== null
                || $this->record->getBlacklistUuid() !== null || $this->record->getEvidenceUuid() !== null || $this->record->getFileAttachmentUuid() !== null);
        }

        /**
         * Returns the loaded audit log record.
         *
         * @return mixed The audit log record.
         */
        public function getRecord(): mixed { return $this->record; }
        /**
         * Determines whether loading the audit log failed.
         *
         * @return bool Whether an error occurred.
         */
        public function hasError(): bool { return $this->error; }
        /**
         * Returns the operator related to the audit log.
         *
         * @return mixed The related operator record.
         */
        public function getOperatorRecord(): mixed { return $this->operatorRecord; }
        /**
         * Returns the entity related to the audit log.
         *
         * @return mixed The related entity record.
         */
        public function getEntityRecord(): mixed { return $this->entityRecord; }
        /**
         * Returns the blacklist record related to the audit log.
         *
         * @return mixed The related blacklist record.
         */
        public function getBlacklistRecord(): mixed { return $this->blacklistRecord; }
        /**
         * Returns the evidence record related to the audit log.
         *
         * @return mixed The related evidence record.
         */
        public function getEvidenceRecord(): mixed { return $this->evidenceRecord; }
        /**
         * Returns the file attachment referenced by the audit log.
         *
         * @return mixed The attachment record, or null when absent or unavailable.
         */
        public function getFileAttachment(): mixed
        {
            if($this->fileAttachmentLoaded) return $this->fileAttachmentRecord;
            $this->fileAttachmentLoaded = true;
            $attachmentUuid = $this->record?->getFileAttachmentUuid();
            if($attachmentUuid === null || $attachmentUuid === '') return null;

            try { $this->fileAttachmentRecord = $this->federationClient->getAttachmentInfo($attachmentUuid); }
            catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load audit log file attachment', $exception); }

            return $this->fileAttachmentRecord;
        }
        /**
         * Returns other audit log entries recorded for the same operator.
         *
         * @return array|null The audit logs, null when loading failed, or an empty array when none exist.
         */
        public function getOperatorAuditLogs(): ?array
        {
            if($this->operatorAuditLogsLoaded) return $this->operatorAuditLogs;
            $this->operatorAuditLogsLoaded = true;
            $operatorUuid = $this->record?->getOperatorUuid();
            if($operatorUuid === null || $operatorUuid === '') return $this->operatorAuditLogs = [];

            try { $this->operatorAuditLogs = $this->collectRelatedLogs($this->federationClient->listOperatorAuditLogs($operatorUuid, 1, 10)); }
            catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load operator audit logs', $exception); }

            return $this->operatorAuditLogs;
        }
        /**
         * Returns other audit log entries recorded for the same entity.
         *
         * @return array|null The audit logs, null when loading failed, or an empty array when none exist.
         */
        public function getEntityAuditLogs(): ?array
        {
            if($this->entityAuditLogsLoaded) return $this->entityAuditLogs;
            $this->entityAuditLogsLoaded = true;
            $entityUuid = $this->record?->getEntityUuid();
            if($entityUuid === null || $entityUuid === '') return $this->entityAuditLogs = [];

            try { $this->entityAuditLogs = $this->collectRelatedLogs($this->federationClient->listEntityAuditLogs($entityUuid, 1, 10)); }
            catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load entity audit logs', $exception); }

            return $this->entityAuditLogs;
        }
        /**
         * Returns a display label for an operator UUID.
         *
         * @param string $operatorUuid The operator UUID to label.
         * @return string The operator name, or a shortened UUID when unknown.
         */
        public function getOperatorLabel(string $operatorUuid): string
        {
            if($this->operatorRecord !== null && $this->operatorRecord->getUuid() === $operatorUuid) return $this->operatorRecord->getName();
            return $this->operatorNames[$operatorUuid] ?? substr($operatorUuid, 0, 8);
        }
        /**
         * Returns a display label for an entity UUID.
         *
         * @param string $entityUuid The entity UUID to label.
         * @return string The entity address, or a shortened UUID when unknown.
         */
        public function getEntityLabel(string $entityUuid): string
        {
            if($this->entityRecord !== null && $this->entityRecord->getUuid() === $entityUuid) return $this->entityRecord->getAddress();
            return $this->entityAddresses[$entityUuid] ?? substr($entityUuid, 0, 8);
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
         * Returns an icon CSS class for a MIME type.
         *
         * @param string|null $mime The MIME type to classify.
         * @return string The icon CSS class.
         */
        public function getMimeIcon(?string $mime): string
        {
            return match(true) {
                str_contains($mime ?? '', 'pdf') => 'bi-filetype-pdf',
                str_contains($mime ?? '', 'image/') => 'bi-file-earmark-image',
                str_contains($mime ?? '', 'video/') => 'bi-file-earmark-play',
                str_contains($mime ?? '', 'audio/') => 'bi-file-earmark-music',
                str_contains($mime ?? '', 'text/') => 'bi-filetype-txt',
                str_contains($mime ?? '', 'json') => 'bi-filetype-json',
                str_contains($mime ?? '', 'xml') => 'bi-filetype-xml',
                str_contains($mime ?? '', 'zip') || str_contains($mime ?? '', 'rar') || str_contains($mime ?? '', 'tar') || str_contains($mime ?? '', 'gzip') => 'bi-file-earmark-zip',
                default => 'bi-file-earmark',
            };
        }
        /**
         * Returns the audit log event type.
         *
         * @return mixed The event type.
         */
        public function getType(): mixed { return $this->type; }
        /**
         * Returns the category of the audit log event.
         *
         * @return mixed The event category.
         */
        public function getCategory(): mixed { return $this->category; }
        /**
         * Determines whether the audit log has related records to display.
         *
         * @return bool Whether related record cards are available.
         */
        public function hasRelatedCards(): bool { return $this->hasRelatedCards; }
        /**
         * Returns the badge CSS class for an audit log event type.
         *
         * @param mixed $type The audit log event type.
         * @return string The badge CSS class.
         */
        public function getTypeBadgeColor(mixed $type): string { return self::getBadgeColor($type->getCategory()->name); }
        /**
         * Returns the badge CSS class for an audit log category.
         *
         * @param string $category The audit log category name.
         * @return string The badge CSS class.
         */
        public function getCategoryBadgeColor(string $category): string { return self::getBadgeColor($category); }
        /**
         * Formats a Unix timestamp for display.
         *
         * @param int $timestamp The Unix timestamp to format.
         * @param string $format The PHP date format to apply.
         * @return string The formatted date.
         */
        public function formatDate(int $timestamp, string $format='Y-m-d H:i:s'): string { return Utilities::formatDate($timestamp, $format); }
        /**
         * Determines whether the page uses dark mode.
         *
         * @return bool Whether dark mode is enabled.
         */
        public function isDarkMode(): bool { return $this->darkMode; }
        /**
         * Returns the current success status message.
         *
         * @return string|null The success message, if present.
         */
        public function getSuccessMessage(): ?string { return $this->successMsg; }
        /**
         * Returns the current error status message.
         *
         * @return string|null The error message, if present.
         */
        public function getErrorMessage(): ?string { return $this->errorMsg; }
        /**
         * Returns the detailed error status message.
         *
         * @return string|null The error detail, if present.
         */
        public function getErrorDetail(): ?string { return $this->errorMessage; }

        /**
         * Returns the summary of the audit log record shown in search results and link previews: the
         * logged message, which describes the event.
         *
         * @return string|null The summary, or null when the record could not be loaded.
         */
        public function getPageDescription(): ?string
        {
            if ($this->record === null)
            {
                return null;
            }

            return Utilities::localize('meta_description_record', [
                'message' => $this->record->getMessage(),
                'server_name' => PageMetadata::getSiteName(),
                'created' => Utilities::formatDate($this->record->getTimestamp(), 'Y-m-d'),
            ]);
        }

        /**
         * Removes the current record from a related audit log listing and resolves its display labels.
         *
         * @param array $auditLogs The audit logs returned by the API.
         * @return array The related audit logs.
         */
        private function collectRelatedLogs(array $auditLogs): array
        {
            $relatedLogs = array_values(array_filter($auditLogs, fn($auditLog): bool => $auditLog->getUuid() !== $this->record?->getUuid()));

            // Only labels not resolved for an earlier listing are looked up; existing keys are kept.
            $this->operatorNames += Utilities::getOperatorNames($this->federationClient, array_diff(
                array_map(static fn($auditLog) => $auditLog->getOperatorUuid(), $relatedLogs), array_keys($this->operatorNames)));
            $this->entityAddresses += Utilities::getEntityAddresses($this->federationClient, array_diff(
                array_map(static fn($auditLog) => $auditLog->getEntityUuid(), $relatedLogs), array_keys($this->entityAddresses)));

            return $relatedLogs;
        }

        /**
         * Returns the badge CSS class for an audit log category.
         *
         * @param string $category The audit log category name.
         * @return string The badge CSS class.
         */
        private static function getBadgeColor(string $category): string
        {
            return match($category) { 'OPERATOR_EVENTS', 'ENTITY_EVENTS' => 'fw-badge-blue', 'ATTACHMENT_EVENTS' => 'fw-badge-purple', 'EVIDENCE_EVENTS' => 'fw-badge-amber', 'REPORT_EVENTS' => 'fw-badge-gray', 'BLACKLIST_EVENTS' => 'fw-badge-red', default => 'fw-badge-gray' };
        }
    }
