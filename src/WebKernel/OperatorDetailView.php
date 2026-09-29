<?php

    namespace WebKernel;

    use DynamicalWeb\Enums\RequestMethod;
    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\WebSession;
    use FederationLib\Enums\AuditLogType;
    use FederationLib\Enums\Categories\AuditLogCategory;
    use FederationLib\FederationClient;

    /**
     * Provides data, formatting, and actions for an operator detail page.
     */
    class OperatorDetailView
    {
        private mixed $operator = null;
        private bool $error = false;
        private ?array $recentAuditLogs = null;
        private ?array $recentReports = null;
        private ?array $assignedReports = null;
        private ?array $evidenceRecords = null;
        private ?array $blacklistRecords = null;
        private mixed $latestAuditLog = null;
        private mixed $latestReport = null;
        private mixed $latestEvidence = null;
        private mixed $latestBlacklist = null;
        private int $evidenceCount = 0;
        private int $blacklistCount = 0;
        private bool $hasRelatedData = false;
        private array $operatorNames = [];
        private array $entityAddresses = [];
        private ?string $newToken = null;
        private bool $darkMode = false;
        private ?string $successMsg = null;
        private ?string $errorMsg = null;
        private ?string $errorMessage = null;

        private FederationClient $federationClient;

        /**
         * OperatorDetailView constructor.
         */
        public function __construct()
        {
            $this->federationClient = WebSession::get('federation_client');
            $this->newToken = $this->takeNewToken(WebSession::getRequest()->getPathParameter('operator_id'));
            $this->darkMode = Utilities::getDarkMode();
            $statusMessages = Utilities::getStatusMessages();
            $this->successMsg = $statusMessages->successMessageKey;
            $this->errorMsg = $statusMessages->errorMessageKey;
            $this->errorMessage = $statusMessages->errorDetail;

            try
            {
                $this->operator = $this->federationClient->getOperator(WebSession::getRequest()->getPathParameter('operator_id'));
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load operator', $exception);
                $this->error = true;
                return;
            }

            // The operator record is public, but each related collection follows the visibility of its
            // own domain, so each is loaded separately and a private domain does not hide the others.
            $uuid = $this->operator->getUuid();
            $this->recentAuditLogs = $this->loadRelated(ViewAuthorization::canReadAuditLogs(), fn() => $this->federationClient->listOperatorAuditLogs($uuid));
            $this->recentReports = $this->loadRelated(ViewAuthorization::canReadReports(), fn() => $this->federationClient->listOperatorReports($uuid));
            $this->assignedReports = $this->loadRelated(ViewAuthorization::canReadReports(), fn() => $this->federationClient->listAssignedOperatorReports($uuid));
            $this->evidenceRecords = $this->loadRelated(ViewAuthorization::canReadEvidence(), fn() => $this->federationClient->listOperatorEvidence($uuid));
            $this->blacklistRecords = $this->loadRelated(ViewAuthorization::canReadBlacklist(), fn() => $this->federationClient->listOperatorBlacklist($uuid));

            [$this->operatorNames, $this->entityAddresses] = $this->loadLabels(
                array_merge($this->recentReports ?? [], $this->assignedReports ?? []), $this->evidenceRecords ?? [], $this->blacklistRecords ?? [], $this->recentAuditLogs ?? []
            );
            $this->latestAuditLog = $this->pickLatest($this->recentAuditLogs, static fn(mixed $record): int => $record->getTimestamp());
            $this->latestReport = $this->pickLatest($this->recentReports, static fn(mixed $record): int => $record->getCreated());
            $this->latestEvidence = $this->pickLatest($this->evidenceRecords, static fn(mixed $record): int => $record->getCreated());
            $this->latestBlacklist = $this->pickLatest($this->blacklistRecords, static fn(mixed $record): int => $record->getCreated());
            $this->evidenceCount = count($this->evidenceRecords ?? []);
            $this->blacklistCount = count($this->blacklistRecords ?? []);
            $this->hasRelatedData = !empty($this->recentAuditLogs) || !empty($this->recentReports) || !empty($this->assignedReports) || !empty($this->evidenceRecords) || !empty($this->blacklistRecords);
        }


        /** Returns the loaded operator record.
         * @return mixed The operator record.
         */
        public function getOperator(): mixed { return $this->operator; }
        /** Determines whether loading the operator failed.
         * @return bool Whether an error occurred.
         */
        public function hasError(): bool { return $this->error; }
        /** Returns recent audit logs for the operator.
         * @return array|null The recent audit logs, or null when loading failed.
         */
        public function getRecentAuditLogs(): ?array { return $this->recentAuditLogs; }
        /** Returns reports submitted by the operator.
         * @return array|null The submitted reports, or null when loading failed.
         */
        public function getRecentReports(): ?array { return $this->recentReports; }
        /** Returns reports assigned to the operator.
         * @return array|null The assigned reports, or null when loading failed.
         */
        public function getAssignedReports(): ?array { return $this->assignedReports; }
        /** Returns evidence records submitted by the operator.
         * @return array|null The evidence records, or null when loading failed.
         */
        public function getEvidenceRecords(): ?array { return $this->evidenceRecords; }
        /** Returns blacklist records created by the operator.
         * @return array|null The blacklist records, or null when loading failed.
         */
        public function getBlacklistRecords(): ?array { return $this->blacklistRecords; }
        /** Returns the operator's most recent audit log entry.
         * @return mixed The audit log entry, or null when none is available.
         */
        public function getLatestAuditLog(): mixed { return $this->latestAuditLog; }
        /** Returns the most recent report submitted by the operator.
         * @return mixed The report record, or null when none is available.
         */
        public function getLatestReport(): mixed { return $this->latestReport; }
        /** Returns the most recent evidence record submitted by the operator.
         * @return mixed The evidence record, or null when none is available.
         */
        public function getLatestEvidence(): mixed { return $this->latestEvidence; }
        /** Returns the most recent blacklist record created by the operator.
         * @return mixed The blacklist record, or null when none is available.
         */
        public function getLatestBlacklist(): mixed { return $this->latestBlacklist; }
        /** Returns the number of evidence records.
         * @return int The evidence record count.
         */
        public function getEvidenceCount(): int { return $this->evidenceCount; }
        /** Returns the number of blacklist records.
         * @return int The blacklist record count.
         */
        public function getBlacklistCount(): int { return $this->blacklistCount; }
        /** Determines whether the operator has related records.
         * @return bool Whether related records exist.
         */
        public function hasRelatedData(): bool { return $this->hasRelatedData; }
        /** Returns operator labels keyed by UUID.
         * @return array The operator labels.
         */
        public function getOperatorNames(): array { return $this->operatorNames; }
        /** Returns entity addresses keyed by UUID.
         * @return array The entity addresses.
         */
        public function getEntityAddresses(): array { return $this->entityAddresses; }
        /** Returns the newly generated access token.
         * @return string|null The generated token, if present.
         */
        public function getNewToken(): ?string { return $this->newToken; }
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
         * Determines the badge colour for an audit log type.
         *
         * @param AuditLogType $type The audit log type to classify.
         * @return string The badge colour suffix.
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
                AuditLogType::BLACKLIST_DELETED,
                AuditLogType::OPERATOR_DISABLED => 'red',

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
         * Keeps a newly generated access token in the session until the operator page shows it.
         *
         * @param string $operatorUuid The operator the token belongs to.
         * @param string $token The generated access token.
         */
        private function storeNewToken(string $operatorUuid, string $token): void
        {
            $cookieSession = WebSession::get('cookie_session');
            if($cookieSession === null)
            {
                return;
            }

            $cookieSession->set('new_operator_token', ['operator' => $operatorUuid, 'token' => $token]);
            WebSession::saveCookieSession($cookieSession);
        }

        /**
         * Returns and forgets the access token generated for an operator, so it is shown only once.
         *
         * @param string|null $operatorUuid The operator whose page is shown.
         * @return string|null The token, or null when none is waiting for this operator.
         */
        private function takeNewToken(?string $operatorUuid): ?string
        {
            $cookieSession = WebSession::get('cookie_session');
            $pending = $cookieSession?->get('new_operator_token');
            if(!is_array($pending) || ($pending['operator'] ?? null) !== $operatorUuid)
            {
                return null;
            }

            $cookieSession->remove('new_operator_token');
            WebSession::saveCookieSession($cookieSession);
            return is_string($pending['token'] ?? null) ? $pending['token'] : null;
        }

        /**
         * Processes the submitted operator action and redirects to its result.
         */
        public function handlePostRequest(): void
        {
            $request = WebSession::getRequest();
            $action = $request->getParameter('action');
            $redirect = ['operator_id' => $this->operator->getUuid()];
            try
            {
                switch($action)
                {
                    case 'edit_operator':
                        $name = $request->getParameter('operator_name');
                        if(empty($name)) throw new \Exception('Operator name is required');
                        $this->federationClient->updateOperatorName($this->operator->getUuid(), $name);
                        $redirect['success'] = 'operator_updated';
                        break;
                    case 'generate_token':
                        // The token is shown once from the session, never placed in the redirect URL,
                        // where it would be kept in browser history and access logs.
                        $this->storeNewToken($this->operator->getUuid(), $this->federationClient->generateOperatorAccessToken($this->operator->getUuid()));
                        $redirect['success'] = 'api_key_refreshed';
                        break;
                    case 'set_permissions':
                        $this->federationClient->setOperatorPermissions($this->operator->getUuid(), $request->getParameter('perm_operator') === '1');
                        $this->federationClient->setClientPermissions($this->operator->getUuid(), $request->getParameter('perm_client') === '1');
                        $this->federationClient->setManagementPermissions($this->operator->getUuid(), $request->getParameter('perm_management') === '1');
                        $redirect['success'] = 'permission_updated';
                        break;
                    case 'disable_operator': $this->federationClient->disableOperator($this->operator->getUuid()); $redirect['success'] = 'operator_disabled'; break;
                    case 'enable_operator': $this->federationClient->enableOperator($this->operator->getUuid()); $redirect['success'] = 'operator_enabled'; break;
                    case 'toggle_auto_assign':
                        $this->federationClient->setAutoAssign($this->operator->getUuid(), !$this->operator->isAutoAssigned());
                        $redirect['success'] = $this->operator->isAutoAssigned() ? 'auto_assign_disabled' : 'auto_assign_enabled';
                        break;
                    case 'delete_operator':
                        $this->federationClient->deleteOperator($this->operator->getUuid());
                        Utilities::redirect('operators', queryParameters: ['success' => 'operator_deleted']);
                }
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to process operator action', $exception);
                $redirect['error'] = match ($action)
                {
                    'edit_operator' => 'operator_rename_failed', 'generate_token' => 'api_key_refresh_failed', 'set_permissions' => 'permission_update_failed',
                    'disable_operator' => 'operator_disable_failed', 'enable_operator' => 'operator_enable_failed', 'toggle_auto_assign' => 'auto_assign_update_failed',
                    'delete_operator' => 'operator_delete_failed', default => $action . '_failed',
                };
                $redirect['error_message'] = $exception->getMessage();
            }

            Utilities::redirect('operator_detail', ['operator_id' => $this->operator->getUuid()], $redirect);
        }

        /**
         * Loads a collection related to the operator.
         *
         * @param bool $readable Whether the requester may read the collection.
         * @param callable $load Fetches the collection.
         * @return array|null The collection, or null when it is not readable or cannot be loaded.
         */
        private function loadRelated(bool $readable, callable $load): ?array
        {
            if(!$readable) return null;

            try
            {
                return $load();
            }
            catch(\Exception $exception)
            {
                Logger::getLogger()->warning('Unable to load operator details', $exception);
                return null;
            }
        }

        /**
         * Returns the most recent record of a collection.
         *
         * @param array|null $records The records to inspect.
         * @param callable $timestamp Resolves the comparable timestamp of a record.
         * @return mixed The most recent record, or null when the collection is empty or unavailable.
         */
        private function pickLatest(?array $records, callable $timestamp): mixed
        {
            $latest = null;
            foreach($records ?? [] as $record)
            {
                if($latest === null || $timestamp($record) >= $timestamp($latest)) $latest = $record;
            }
            return $latest;
        }

        /**
         * Loads labels for records related to the operator.
         *
         * @param array $reports The reports from which to collect labels.
         * @param array $evidenceRecords The evidence records from which to collect labels.
         * @param array $blacklistRecords The blacklist records from which to collect labels.
         * @param array $auditLogs The audit logs from which to collect labels.
         * @return array The operator and entity label maps.
         */
        private function loadLabels(array $reports, array $evidenceRecords, array $blacklistRecords, array $auditLogs): array
        {
            $operatorUuids = [];
            $entityUuids = [];
            foreach($reports as $report)
            {
                $operatorUuids[$report->getSubmittingOperator()] = true;
                if($report->getAssignedOperator() !== null) $operatorUuids[$report->getAssignedOperator()] = true;
                if($report->getReportingEntity() !== null) $entityUuids[$report->getReportingEntity()] = true;
            }
            foreach($evidenceRecords as $evidence) $entityUuids[$evidence->getEntityUuid()] = true;
            foreach($blacklistRecords as $blacklist) $entityUuids[$blacklist->getEntityUuid()] = true;
            foreach($auditLogs as $auditLog) if($auditLog->getEntityUuid() !== null) $entityUuids[$auditLog->getEntityUuid()] = true;

            return [$this->loadOperatorNames(array_keys($operatorUuids)), $this->loadEntityAddresses(array_keys($entityUuids))];
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
