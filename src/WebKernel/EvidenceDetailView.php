<?php

    namespace WebKernel;

    use DynamicalWeb\Enums\RequestMethod;
    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use FederationLib\Enums\AuditLogType;
    use FederationLib\Enums\ClassificationFlag;
    use FederationLib\FederationClient;

    /**
     * Provides data, formatting, downloads, and actions for an evidence detail page.
     */
    class EvidenceDetailView
    {
        private mixed $evidence = null;
        private bool $error = false;
        private mixed $entityRecord = null;
        private mixed $operatorRecord = null;
        private mixed $reportRecord = null;
        private mixed $blacklistRecord = null;
        private ?array $attachments = [];
        private ?array $auditLogs = [];
        private ?array $entityReports = [];
        private ?array $entityEvidence = [];
        private ?array $entityBlacklist = [];
        private array $operatorNames = [];
        private array $entityAddresses = [];
        private mixed $classificationFlag = null;
        private ?string $classificationBadge = null;
        private bool $darkMode = false;
        private ?string $successMessage = null;
        private ?string $errorMessage = null;
        private ?string $errorDetail = null;

        private FederationClient $federationClient;

        /**
         * EvidenceDetailView constructor.
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
                $this->evidence = Utilities::getEvidence($this->federationClient, WebSession::getRequest()->getPathParameter('evidence_uuid'));
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load evidence record', $exception);
                $this->error = true;
                return;
            }

            if($this->evidence === null) return;

            if (ViewAuthorization::canReadEntities()) try { $this->entityRecord = $this->federationClient->getEntityRecord($this->evidence->getEntityUuid()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load evidence entity', $exception); }
            if (ViewAuthorization::canReadOperatorRecords()) try { $this->operatorRecord = $this->federationClient->getOperator($this->evidence->getOperatorUuid()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load evidence operator', $exception); }
            if (ViewAuthorization::canReadReports() && ($reportUuid = $this->evidence->getReport()) !== null && $reportUuid !== '') { try { $this->reportRecord = Utilities::getReport($this->federationClient, $reportUuid); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load evidence report', $exception); } }
            if (ViewAuthorization::canManageRecords()) try { $this->attachments = $this->federationClient->getEvidenceAttachments($this->evidence->getUuid()); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load evidence attachments', $exception); $this->attachments = null; }
            else $this->attachments = [];
            if (ViewAuthorization::canReadAuditLogs()) $this->auditLogs = Utilities::collectAuditLogs([fn(int $page): array => $this->federationClient->listEntityAuditLogs($this->evidence->getEntityUuid(), $page, 100)], fn($log): bool => $log->getEvidenceUuid() === $this->evidence->getUuid());
            else $this->auditLogs = [];
            if($this->entityRecord !== null)
            {
                if (ViewAuthorization::canReadReports()) try { $this->entityReports = $this->federationClient->listEntityReports($this->entityRecord->getUuid(), 1, 100); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load evidence entity reports', $exception); $this->entityReports = null; }
                else $this->entityReports = [];
                if (ViewAuthorization::canReadEvidence()) try { $this->entityEvidence = array_values(array_filter($this->federationClient->listEntityEvidenceRecords($this->entityRecord->getUuid(), 1, 100, ViewAuthorization::canManageRecords()), fn(mixed $record): bool => $record->getUuid() !== $this->evidence->getUuid())); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load evidence entity records', $exception); $this->entityEvidence = null; }
                else $this->entityEvidence = [];
                if (ViewAuthorization::canReadBlacklist()) try { $this->entityBlacklist = $this->federationClient->listEntityBlacklistRecords($this->entityRecord->getUuid(), 1, 100, includeLifted: true); } catch(\Exception $exception) { Logger::getLogger()->warning('Unable to load evidence entity blacklist', $exception); $this->entityBlacklist = null; }
                else $this->entityBlacklist = [];
            }
            $evidenceReportUuid = $this->evidence->getReport();
            if($evidenceReportUuid !== null) foreach($this->entityBlacklist ?? [] as $blacklist) { if($blacklist->getReportUuid() === $evidenceReportUuid) { $this->blacklistRecord = $blacklist; break; } }
            $operatorUuids = [$this->evidence->getOperatorUuid() => true];
            $entityUuids = [$this->evidence->getEntityUuid() => true];
            if($this->reportRecord !== null) { $operatorUuids[$this->reportRecord->getSubmittingOperator()] = true; if($this->reportRecord->getAssignedOperator() !== null) $operatorUuids[$this->reportRecord->getAssignedOperator()] = true; if($this->reportRecord->getReportingEntity() !== null) $entityUuids[$this->reportRecord->getReportingEntity()] = true; }
            if($this->blacklistRecord !== null) { $operatorUuids[$this->blacklistRecord->getOperatorUuid()] = true; if($this->blacklistRecord->getLiftedBy() !== null) $operatorUuids[$this->blacklistRecord->getLiftedBy()] = true; }
            foreach($this->entityReports ?? [] as $report) { $operatorUuids[$report->getSubmittingOperator()] = true; if($report->getAssignedOperator() !== null) $operatorUuids[$report->getAssignedOperator()] = true; }
            foreach($this->entityEvidence ?? [] as $evidence) $operatorUuids[$evidence->getOperatorUuid()] = true;
            foreach($this->entityBlacklist ?? [] as $blacklist) { $operatorUuids[$blacklist->getOperatorUuid()] = true; if($blacklist->getLiftedBy() !== null) $operatorUuids[$blacklist->getLiftedBy()] = true; }
            foreach($this->auditLogs ?? [] as $log) { if($log->getOperatorUuid() !== null) $operatorUuids[$log->getOperatorUuid()] = true; if($log->getEntityUuid() !== null) $entityUuids[$log->getEntityUuid()] = true; }
            $this->operatorNames = $this->loadOperatorNames(array_keys($operatorUuids));
            $this->entityAddresses = $this->loadEntityAddresses(array_keys($entityUuids));
            $this->classificationFlag = $this->evidence->getClassificationFlag();
            $this->classificationBadge = $this->classificationFlag === null ? null : match($this->classificationFlag) { ClassificationFlag::MALICIOUS => 'fw-badge-red', ClassificationFlag::SUSPICIOUS => 'fw-badge-amber', ClassificationFlag::NORMAL => 'fw-badge-green' };
        }

        /** Returns the loaded evidence record.
         * @return mixed The evidence record.
         */
        public function getEvidence(): mixed { return $this->evidence; }
        /** Determines whether loading the evidence failed.
         * @return bool Whether an error occurred.
         */
        public function hasError(): bool { return $this->error; }
        /** Returns the entity related to the evidence.
         * @return mixed The entity record.
         */
        public function getEntityRecord(): mixed { return $this->entityRecord; }
        /** Returns the operator who submitted the evidence.
         * @return mixed The operator record.
         */
        public function getOperatorRecord(): mixed { return $this->operatorRecord; }
        /** Returns the report containing the evidence.
         * @return mixed The report record.
         */
        public function getReportRecord(): mixed { return $this->reportRecord; }
        /** Returns the blacklist record derived from this evidence.
         * @return mixed The blacklist record, if the evidence produced one.
         */
        public function getBlacklistRecord(): mixed { return $this->blacklistRecord; }
        /** Returns the evidence attachments.
         * @return array|null The attachments, or null when loading failed.
         */
        public function getAttachments(): ?array { return $this->attachments; }
        /** Returns audit logs associated with the evidence.
         * @return array|null The associated audit logs, or null when loading failed.
         */
        public function getAuditLogs(): ?array { return $this->auditLogs; }
        /** Returns reports related to the evidence entity.
         * @return array|null The related reports, or null when loading failed.
         */
        public function getEntityReports(): ?array { return $this->entityReports; }
        /** Returns the other evidence records of the evidence entity.
         * @return array|null The related evidence records, or null when loading failed.
         */
        public function getEntityEvidence(): ?array { return $this->entityEvidence; }
        /** Returns blacklist records related to the evidence entity.
         * @return array|null The related blacklist records, or null when loading failed.
         */
        public function getEntityBlacklist(): ?array { return $this->entityBlacklist; }
        /** Returns operator labels keyed by UUID.
         * @return array The operator labels.
         */
        public function getOperatorNames(): array { return $this->operatorNames; }
        /** Returns entity addresses keyed by UUID.
         * @return array The entity addresses.
         */
        public function getEntityAddresses(): array { return $this->entityAddresses; }
        /** Returns the evidence classification flag.
         * @return mixed The classification flag.
         */
        public function getClassificationFlag(): mixed { return $this->classificationFlag; }
        /** Returns the classification badge CSS class.
         * @return string|null The badge CSS class, if classified.
         */
        public function getClassificationBadge(): ?string { return $this->classificationBadge; }
        /**
         * Returns the badge CSS class for an arbitrary classification flag.
         *
         * @param mixed $classification The classification flag to render.
         * @return string The badge CSS class.
         */
        public function getClassificationBadgeColor(mixed $classification): string
        {
            return match($classification?->name) {
                'MALICIOUS' => 'fw-badge-red',
                'SUSPICIOUS' => 'fw-badge-amber',
                'NORMAL' => 'fw-badge-green',
                default => 'fw-badge-gray',
            };
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
         * Formats a Unix timestamp for display.
         *
         * @param int $timestamp The Unix timestamp to format.
         * @param string $format The PHP date format to apply.
         * @return string The formatted date.
         */
        public function formatDate(int $timestamp, string $format='Y-m-d H:i:s'): string { return Utilities::formatDate($timestamp, $format); }
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
                str_contains($mime ?? '', 'zip') || str_contains($mime ?? '', 'rar') || str_contains($mime ?? '', 'tar') || str_contains($mime ?? '', 'gzip') => 'bi-file-earmark-zip',
                str_contains($mime ?? '', 'json') => 'bi-filetype-json',
                str_contains($mime ?? '', 'xml') => 'bi-filetype-xml',
                str_contains($mime ?? '', 'html') => 'bi-filetype-html',
                str_contains($mime ?? '', 'javascript') => 'bi-filetype-js',
                default => 'bi-file-earmark',
            };
        }
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
         * Downloads an evidence attachment or redirects with an error.
         *
         * @param string $attachmentUuid The attachment UUID to download.
         */
        public function handleAttachmentDownload(string $attachmentUuid): void
        {
            try
            {
                // Each download gets its own directory: files are saved under their original name, so
                // a shared directory would let concurrent downloads of equally named files replace or
                // delete each other and hand one user another user's file.
                $directory = sys_get_temp_dir() . '/fw_downloads/' . bin2hex(random_bytes(16));
                if(!@mkdir($directory, 0700, true)) throw new \RuntimeException('Unable to create a temporary download directory');
                register_shutdown_function(static function() use ($directory): void
                {
                    foreach(glob($directory . '/*') ?: [] as $file) @unlink($file);
                    @rmdir($directory);
                });
                $filePath = $this->federationClient->downloadAttachment($attachmentUuid, $directory);
                $attachment = $this->federationClient->getAttachmentInfo($attachmentUuid);
                Utilities::respondWithDownload($filePath, $attachment->getFileName() ?: 'download', $attachment->getFileMime() ?: 'application/octet-stream');
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to download evidence attachment', $exception);
                Utilities::redirect('evidence_detail', ['evidence_uuid' => $this->evidence->getUuid()], ['error' => 'attachment_download_failed', 'error_message' => $exception->getMessage()]);
            }
        }

        /**
         * Processes the submitted evidence action and redirects to its result.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest();
            $action = $request->getParameter('action');
            $redirect = ['evidence_uuid' => $this->evidence->getUuid()];
            try
            {
                switch($action)
                {
                    case 'toggle_confidential': $this->federationClient->updateEvidenceConfidentiality($this->evidence->getUuid(), !$this->evidence->isConfidential()); $redirect['success'] = $this->evidence->isConfidential() ? 'confidential_unset' : 'confidential_set'; break;
                    case 'update_tag': $tag = $request->getParameter('evidence_tag'); if(empty($tag)) throw new \Exception('Tag is required'); $this->federationClient->updateEvidenceTag($this->evidence->getUuid(), $tag); $redirect['success'] = 'tag_updated'; break;
                    case 'add_to_report': $reportUuid = $request->getParameter('report_uuid'); if(empty($reportUuid)) throw new \Exception('Report UUID is required'); $this->federationClient->addEvidenceToReport($this->evidence->getUuid(), $reportUuid); $redirect['success'] = 'evidence_added_to_report'; break;
                    case 'delete_evidence': $this->federationClient->deleteEvidence($this->evidence->getUuid()); Utilities::redirect('evidence', queryParameters: ['success' => 'evidence_deleted']);
                    case 'upload_attachment':
                        if(!isset($_FILES['attachment_file']) || $_FILES['attachment_file']['error'] !== UPLOAD_ERR_OK)
                        {
                            $code = $_FILES['attachment_file']['error'] ?? -1;
                            $message = match($code) { UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => Utilities::localize('file_too_large'), UPLOAD_ERR_NO_FILE => Utilities::localize('no_file_selected'), default => Utilities::localize('upload_failed') . ' ' . $code };
                            throw new \Exception($message);
                        }
                        $file = $_FILES['attachment_file'];
                        $this->federationClient->uploadFileAttachment($this->evidence->getUuid(), $file['tmp_name'], $file['name']);
                        $redirect['success'] = 'upload_attachment_success';
                        break;
                    case 'delete_attachment': $attachmentUuid = $request->getParameter('attachment_uuid'); if(empty($attachmentUuid)) throw new \Exception('Attachment UUID is required'); $this->federationClient->deleteAttachment($attachmentUuid); $redirect['success'] = 'delete_attachment_success'; break;
                }
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to process evidence action', $exception);
                $redirect['error'] = match($action) { 'toggle_confidential' => 'confidential_toggle_failed', 'update_tag' => 'tag_update_failed', 'add_to_report' => 'evidence_add_to_report_failed', 'delete_evidence' => 'evidence_delete_failed', 'upload_attachment' => 'upload_attachment_failed', 'delete_attachment' => 'delete_attachment_failed', default => $action . '_failed' };
                $redirect['error_message'] = $exception->getMessage();
            }
            Utilities::redirect('evidence_detail', ['evidence_uuid' => $this->evidence->getUuid()], $redirect);
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
