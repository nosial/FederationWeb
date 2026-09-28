<?php

    namespace WebKernel;

    use DynamicalWeb\WebSession;
    use FederationLib\Enums\HttpResponseCode;
    use FederationLib\Exceptions\RequestException;
    use FederationLib\FederationClient;
    use FederationLib\Objects\ServerInformation;

    /**
     * Resolves UI visibility from the active web session and server visibility settings.
     *
     * This class does not replace OFD API authorization. The API remains responsible for
     * rejecting unauthorized requests with HTTP 401 or 403.
     */
    final class ViewAuthorization
    {
        /**
         * Returns whether the request has no authenticated operator access token.
         */
        public static function isAnonymous(): bool
        {
            $session = self::getCookieSession();

            return $session === null
                || !self::getBoolean('authenticated', false)
                || self::getBoolean('is_anonymous', true)
                || empty($session->get('api_key'))
                || empty($session->get('operator_uuid'));
        }

        /**
         * Returns whether the authenticated operator has client permissions.
         */
        public static function canActAsClient(): bool
        {
            return !self::isAnonymous() && self::getBoolean('is_client', false);
        }

        /**
         * Returns whether the authenticated operator has management permissions.
         */
        public static function canManageRecords(): bool
        {
            return !self::isAnonymous() && self::getBoolean('can_manage_blacklist', false);
        }

        /**
         * Returns whether the authenticated operator has operator-management permissions.
         */
        public static function canManageOperators(): bool
        {
            return !self::isAnonymous() && self::getBoolean('can_manage_operators', false);
        }

        /**
         * Returns whether the operator directory may be read.
         */
        public static function canReadOperatorRecords(): bool
        {
            return self::canManageOperators();
        }

        /**
         * Returns whether the operator can create or update contributed content.
         */
        public static function canContribute(): bool
        {
            return self::canActAsClient() || self::canManageRecords();
        }

        /**
         * Returns whether the operator can manage entity relationships and evidence tags.
         */
        public static function canManageEntityRelationships(): bool
        {
            return self::canManageOperators();
        }

        /**
         * Returns the UUID of the signed-in operator, or null for an anonymous session.
         */
        public static function currentOperatorUuid(): ?string
        {
            if (self::isAnonymous())
            {
                return null;
            }
            $operatorUuid = self::getCookieSession()?->get('operator_uuid');
            return is_string($operatorUuid) && $operatorUuid !== '' ? $operatorUuid : null;
        }

        /**
         * Returns whether the operator may close the given report: an open report and management
         * permissions. The server refuses a close from anyone but the assignee, so the web application
         * assigns the requesting operator to the report before closing it when they are not already assigned.
         *
         * @param mixed $report The report record.
         */
        public static function canCloseReport(mixed $report): bool
        {
            return self::canManageRecords()
                && $report !== null
                && $report->isOpened()
                && !empty(self::currentOperatorUuid());
        }

        /**
         *
         */
        public static function canReadEntityMetadata(): bool
        {
            return self::canManageRecords() || self::canManageOperators();
        }

        /**
         * Returns whether evidence records may be read by the current requester.
         */
        public static function canReadEvidence(): bool
        {
            return !self::isAnonymous() || self::getServerInformation()?->isPublicEvidence() === true;
        }

        /**
         * Returns whether blacklist records may be read by the current requester.
         */
        public static function canReadBlacklist(): bool
        {
            return !self::isAnonymous() || self::getServerInformation()?->isPublicBlacklist() === true;
        }

        /**
         * Returns whether entity records may be read by the current requester.
         */
        public static function canReadEntities(): bool
        {
            return !self::isAnonymous() || self::getServerInformation()?->isPublicEntities() === true;
        }

        /**
         * Determines if the current user has permission to read reports.
         *
         * @return bool True if the user can read reports, false otherwise.
         */
        public static function canReadReports(): bool
        {
            return !self::isAnonymous() || self::getServerInformation()?->isPublicReports() === true;
        }

        /** Returns whether audit logs may be read by the current requester. */
        public static function canReadAuditLogs(): bool
        {
            return !self::isAnonymous() || self::getServerInformation()?->isPublicAuditLogs() === true;
        }

        /**
         * Returns whether the route may be rendered for the current requester.
         */
        public static function canViewRoute(string $routeId, ServerInformation $serverInformation): bool
        {
            if ($routeId === 'api_specification')
            {
                return self::supportsSpecification();
            }

            if (!self::isAnonymous())
            {
                return match ($routeId)
                {
                    'operators', 'operator_detail', 'operators_list_print', 'operator_detail_print' => self::canManageOperators(),
                    default => true,
                };
            }

            return match ($routeId)
            {
                'dashboard', 'fw_toggle_dark_mode' => true,
                'audit_log', 'audit_log_list_print', 'audit_log_detail', 'audit_log_detail_print' => $serverInformation->isPublicAuditLogs(),
                'evidence', 'evidence_list_print', 'evidence_detail', 'evidence_detail_print' => $serverInformation->isPublicEvidence(),
                'blacklist', 'blacklist_list_print', 'blacklist_detail', 'blacklist_detail_print' => $serverInformation->isPublicBlacklist(),
                'entities', 'entities_list_print', 'entity_query', 'entity_detail', 'entity_detail_print' => $serverInformation->isPublicEntities(),
                'reports', 'reports_list_print', 'report_detail', 'report_detail_print' => $serverInformation->isPublicReports(),
                'search' => $serverInformation->isPublicAuditLogs()
                    || $serverInformation->isPublicEvidence()
                    || $serverInformation->isPublicBlacklist()
                    || $serverInformation->isPublicEntities()
                    || $serverInformation->isPublicReports(),
                default => false,
            };

        }

        /**
         * Returns whether the connected server exposes the OpenAPI specification.
         *
         * <p>The /specification endpoint is a FederationLib feature rather than part of the federation
         * specification, so other server implementations may not provide it. The first probe per server
         * endpoint is remembered in the cookie session, and a successfully fetched specification is kept
         * in the request session under 'specification' so the specification page does not fetch it twice.
         * Transient failures are not remembered, so the next request probes again.
         */
        public static function supportsSpecification(): bool
        {
            $supported = WebSession::get('specification_supported');
            if (is_bool($supported))
            {
                return $supported;
            }

            /** @var FederationClient|null $federationClient */
            $federationClient = WebSession::get('federation_client');
            if ($federationClient === null)
            {
                return false;
            }

            $session = self::getCookieSession();
            $cached = $session?->get('specification_support');
            if (is_array($cached) && ($cached['endpoint'] ?? null) === $federationClient->getEndpoint() && is_bool($cached['supported'] ?? null))
            {
                WebSession::set('specification_supported', $cached['supported']);
                return $cached['supported'];
            }

            $remember = true;
            try
            {
                WebSession::set('specification', $federationClient->getSpecification());
                $supported = true;
            }
            catch (RequestException $e)
            {
                $supported = false;
                $remember = in_array($e->getCode(), [
                    HttpResponseCode::NOT_FOUND->value,
                    HttpResponseCode::METHOD_NOT_ALLOWED->value,
                    HttpResponseCode::NOT_IMPLEMENTED->value,
                ], true);
            }

            WebSession::set('specification_supported', $supported);
            if ($remember && $session !== null)
            {
                $session->set('specification_support', ['endpoint' => $federationClient->getEndpoint(), 'supported' => $supported]);
                WebSession::saveCookieSession($session);
            }

            return $supported;
        }

        /**
         * Retrieves a boolean value from a cookie session.
         *
         * @param string $key The key to retrieve the value for.
         * @param bool $default The default value to return if the key is not found or the value cannot be converted to a boolean.
         * @return bool The retrieved boolean value, or the default value if conversion fails.
         */
        private static function getBoolean(string $key, bool $default): bool
        {
            $value = self::getCookieSession()?->get($key, $default);

            if (is_bool($value))
            {
                return $value;
            }

            if (is_int($value))
            {
                return $value === 1;
            }

            if (is_string($value))
            {
                return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
            }

            return $default;
        }

        /**
         * Returns the server visibility settings for the current request.
         */
        private static function getServerInformation(): ?ServerInformation
        {
            $serverInformation = WebSession::get('server_information');

            return $serverInformation instanceof ServerInformation ? $serverInformation : null;
        }

        /**
         * Returns the request-scoped cookie session when one is available.
         */
        private static function getCookieSession(): mixed
        {
            $session = WebSession::get('cookie_session');

            if ($session !== null)
            {
                return $session;
            }

            return WebSession::hasCookieSession('web_session')
                ? WebSession::getCookieSession('web_session')
                : null;
        }
    }
