<?php

    namespace WebKernel;

    use DynamicalWeb\Classes\Logger;
    use DynamicalWeb\Html\Functions;
    use DynamicalWeb\WebSession;
    use FederationLib\FederationClient;
    use FederationLib\Objects\EvidenceRecord;
    use FederationLib\Objects\ReportRecord;

    /**
     * Provides common web application utility functions.
     */
    class Utilities
    {
        /**
         * Determine whether the current session uses dark mode.
         *
         * @return bool True when dark mode is enabled.
         */
        public static function getDarkMode(): bool
        {
            $cookieSession = WebSession::get('cookie_session');

            return (bool)($cookieSession?->get('dark_mode', true) ?? true);
        }

        /**
         * Retrieve redirect status metadata from the request query string.
         *
         * @return StatusMessages Typed status metadata for view consumption.
         */
        public static function getStatusMessages(): StatusMessages
        {
            $queryParameters = WebSession::getRequest()->getQueryParameters();

            // Message keys come from the query string, so only keys the locale defines are shown;
            // anything else would make the page fail to render.
            return new StatusMessages(
                successMessageKey: self::localeKeyOrNull($queryParameters['success'] ?? null),
                errorMessageKey: self::localeKeyOrNull($queryParameters['error'] ?? null),
                errorDetail: $queryParameters['error_message'] ?? null,
            );
        }

        /**
         * Returns a localized string for the current route's locale section, falling back to the
         * global section. Unlike {@see Functions::printl()}, which prints, this returns the text.
         *
         * @param string $key The locale key.
         * @param array $parameters Placeholder replacements.
         * @return string The localized text, or the key itself when it is not defined.
         */
        public static function localize(string $key, array $parameters=[]): string
        {
            $section = WebSession::getCurrentRoute()?->getLocaleId() ?? 'global';
            return WebSession::getLocale()?->getString($section, $key, $parameters) ?? $key;
        }

        /**
         * Returns the key when the current locale defines it, or null otherwise.
         *
         * @param mixed $key The candidate locale key.
         * @return string|null The key, or null when it is missing, not a string or not defined.
         */
        private static function localeKeyOrNull(mixed $key): ?string
        {
            if(!is_string($key) || $key === '')
            {
                return null;
            }

            $section = WebSession::getCurrentRoute()?->getLocaleId() ?? 'global';
            return WebSession::getLocale()?->getString($section, $key) !== null ? $key : null;
        }

        /**
         * Returns the session's CSRF token, creating it on first use.
         *
         * <p>Every state-changing request must echo this token, either as the csrf_token form field
         * or the X-CSRF-Token header; see pre_processors/authentication.phtml.
         *
         * @return string The token, or an empty string when there is no session.
         */
        public static function getCsrfToken(): string
        {
            $cookieSession = WebSession::get('cookie_session');
            if($cookieSession === null)
            {
                return '';
            }

            $token = $cookieSession->get('csrf_token');
            if(!is_string($token) || $token === '')
            {
                $token = bin2hex(random_bytes(32));
                $cookieSession->set('csrf_token', $token);
                WebSession::saveCookieSession($cookieSession);
            }

            return $token;
        }

        /**
         * Returns whether a submitted value matches the session's CSRF token.
         *
         * @param string|null $token The submitted token.
         * @return bool True when the token is present and matches.
         */
        public static function isValidCsrfToken(?string $token): bool
        {
            $expected = WebSession::get('cookie_session')?->get('csrf_token');
            return is_string($expected) && $expected !== '' && is_string($token) && hash_equals($expected, $token);
        }

        /**
         * Format a Unix timestamp for display.
         *
         * @param int $timestamp Unix timestamp to format.
         * @param string $format PHP date format to apply.
         * @return string Formatted date, or an em dash for a non-positive timestamp.
         */
        public static function formatDate(int $timestamp, string $format='Y-m-d H:i'): string
        {
            return $timestamp > 0 ? date($format, $timestamp) : '—';
        }

        /**
         * Send a JSON response and end the web session.
         *
         * @param array $data Response payload to encode as JSON.
         */
        public static function respondWithJson(array $data): void
        {
            WebSession::getResponse()->setJson($data);
            WebSession::endSession(0);
        }

        /**
         * Redirect to a named route and end the web session.
         *
         * @param string $route Name of the route to redirect to.
         * @param array $pathVariables Values for the route path variables.
         * @param array $queryParameters Query parameters to append to the route.
         */
        public static function redirect(string $route, array $pathVariables=[], array $queryParameters=[]): void
        {
            WebSession::getResponse()->setRedirect(Functions::getRouteUrl(
                $route,
                pathVariables: $pathVariables,
                queryParams: $queryParameters
            ));
            WebSession::endSession(0);
        }

        /**
         * Send a file download response and end the web session.
         *
         * @param string $filePath Path to the file to download.
         * @param string $filename Filename presented to the client.
         * @param string|null $mimeType MIME type to set for the response, when provided.
         */
        public static function respondWithDownload(string $filePath, string $filename, ?string $mimeType=null): void
        {
            $response = WebSession::getResponse()->setFileDownload($filePath, $filename);
            if($mimeType !== null)
            {
                $response->setHeader('Content-Type', $mimeType);
            }

            register_shutdown_function(static fn() => @unlink($filePath));
            WebSession::endSession(0);
        }

        /**
         * Resolves operator names for table and card labels.
         *
         * <p>When more than one operator is not yet known, the operator list is loaded once instead of
         * each operator separately; see {@see CachingFederationClient}. Operators the list does not
         * cover are still looked up one at a time.
         *
         * @param FederationClient $client The client to query.
         * @param array<string|null> $uuids The operator UUIDs; empty values and repeats are ignored.
         * @return array<string, string|null> Operator names keyed by UUID, or null where unavailable or not permitted.
         */
        public static function getOperatorNames(FederationClient $client, array $uuids): array
        {
            $uuids = array_values(array_unique(array_filter($uuids, static fn($uuid): bool => $uuid !== null && $uuid !== '')));
            if(!ViewAuthorization::canReadOperatorRecords())
            {
                return array_fill_keys($uuids, null);
            }

            if($client instanceof CachingFederationClient && count(array_filter($uuids, static fn(string $uuid): bool => !$client->hasOperator($uuid))) > 1)
            {
                try
                {
                    $client->listOperators();
                }
                catch(\Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load the operator list for labels', $exception);
                }
            }

            $names = [];
            foreach($uuids as $uuid)
            {
                try
                {
                    $names[$uuid] = $client->getOperator($uuid)->getName();
                }
                catch(\Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load operator label', $exception);
                    $names[$uuid] = null;
                }
            }

            return $names;
        }

        /**
         * Resolves entity addresses for table and card labels.
         *
         * @param FederationClient $client The client to query.
         * @param array<string|null> $uuids The entity UUIDs; empty values and repeats are ignored.
         * @return array<string, string|null> Entity addresses keyed by UUID, or null where unavailable.
         */
        public static function getEntityAddresses(FederationClient $client, array $uuids): array
        {
            $addresses = [];
            foreach(array_unique(array_filter($uuids, static fn($uuid): bool => $uuid !== null && $uuid !== '')) as $uuid)
            {
                try
                {
                    $addresses[$uuid] = $client->getEntityRecord($uuid)->getAddress();
                }
                catch(\Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load entity label', $exception);
                    $addresses[$uuid] = null;
                }
            }

            return $addresses;
        }

        /**
         * Fetches a report, with the empty strings the server's record cache substitutes for null
         * turned back into null.
         *
         * <p>The server caches single records in Redis hashes, which store null as an empty string,
         * so a cached unassigned report comes back with an assigned operator of '' rather than null.
         *
         * @param FederationClient $client The client to query.
         * @param string $reportUuid The report UUID.
         * @return ReportRecord The report.
         */
        public static function getReport(FederationClient $client, string $reportUuid): ReportRecord
        {
            return self::withoutCacheBlanks($client->getReport($reportUuid), ['reporting_entity', 'assigned_operator', 'message']);
        }

        /**
         * Fetches an evidence record with its metadata and without cache-substituted empty strings.
         * See {@see Utilities::getReport()} and {@see Utilities::withEvidenceMetadata()}.
         *
         * @param FederationClient $client The client to query.
         * @param string $evidenceUuid The evidence UUID.
         * @return EvidenceRecord The evidence record.
         */
        public static function getEvidence(FederationClient $client, string $evidenceUuid): EvidenceRecord
        {
            $evidence = self::withoutCacheBlanks($client->getEvidenceRecord($evidenceUuid), ['text_content', 'note', 'tag', 'report', 'classification_flag']);
            return self::withEvidenceMetadata($client, $evidence);
        }

        /**
         * Rebuilds a record with the given nullable fields set to null where they are empty strings.
         *
         * @template T of ReportRecord|EvidenceRecord
         * @param T $record The record.
         * @param string[] $nullableKeys The toArray() keys that are null when empty.
         * @return T The normalized record.
         */
        private static function withoutCacheBlanks(ReportRecord|EvidenceRecord $record, array $nullableKeys): ReportRecord|EvidenceRecord
        {
            $data = $record->toArray();
            $changed = false;
            foreach($nullableKeys as $key)
            {
                if(array_key_exists($key, $data) && $data[$key] === '')
                {
                    $data[$key] = null;
                    $changed = true;
                }
            }
            return $changed ? $record::fromArray($data) : $record;
        }

        /**
         * The most pages a view reads when it needs a whole filtered result set to count and
         * paginate it itself. Without a ceiling, one list view on a large server would download the
         * entire table; past this many pages the results shown are the first ones only.
         */
        public const int MAX_FETCH_PAGES = 50;

        /** Pages of 100 audit entries read per source before giving up. */
        private const int AUDIT_LOG_LOOKUP_PAGES = 5;

        /**
         * Collects the audit entries that concern one record, newest first.
         *
         * <p>Reading the most recent entries of the whole audit log and filtering them only finds the
         * history of records touched recently: on a busy server an older record shows none. Each
         * source is instead a scoped listing (an entity's or an operator's audit log) read page by
         * page, so the search follows the record rather than the server's overall activity.
         *
         * @param array<callable(int): array> $sources Page fetchers, each taking a 1-based page number.
         * @param callable(mixed): bool $filter Whether an entry concerns the record.
         * @return array|null The matching entries, or null when every source failed to load.
         */
        public static function collectAuditLogs(array $sources, callable $filter): ?array
        {
            $entries = [];
            $failures = 0;
            foreach($sources as $source)
            {
                try
                {
                    for($page = 1; $page <= self::AUDIT_LOG_LOOKUP_PAGES; $page++)
                    {
                        $logs = $source($page);
                        foreach($logs as $log)
                        {
                            if($filter($log))
                            {
                                $entries[$log->getUuid()] = $log;
                            }
                        }
                        if(count($logs) < 100)
                        {
                            break;
                        }
                    }
                }
                catch(\Exception $exception)
                {
                    Logger::getLogger()->warning('Unable to load audit logs', $exception);
                    $failures++;
                }
            }

            if($failures > 0 && $failures === count($sources))
            {
                return null;
            }

            $entries = array_values($entries);
            usort($entries, static fn($a, $b): int => $b->getTimestamp() <=> $a->getTimestamp());
            return $entries;
        }

        /** Pages of 100 records searched for a copy of an evidence record before giving up. */
        private const int EVIDENCE_METADATA_LOOKUP_PAGES = 5;

        /**
         * Returns the evidence record with its metadata, working around the server's record cache.
         *
         * <p>The server caches single evidence records in a Redis hash, which cannot hold the nested
         * metadata array: it is stored as the string "Array", so once a record is cached,
         * {@see FederationClient::getEvidenceRecord()} returns it with its metadata missing. The list
         * endpoints read the database (or a JSON-encoded result cache) and are unaffected, so when the
         * metadata is missing the same record is looked up there instead — first among its report's
         * evidence, which is small, then among its entity's.
         *
         * @param FederationClient $client The client to query.
         * @param EvidenceRecord $evidence The record as returned by getEvidenceRecord().
         * @return EvidenceRecord The record with its metadata, or the given record when no copy
         *         carrying metadata was found (including when it genuinely has none).
         */
        public static function withEvidenceMetadata(FederationClient $client, EvidenceRecord $evidence): EvidenceRecord
        {
            if(!empty($evidence->getMetadata()))
            {
                return $evidence;
            }

            // A confidential record is only listed with confidential records included, which the
            // server allows only to managers; anyone who could read this record is one.
            $includeConfidential = $evidence->isConfidential();
            $sources = [];
            $reportUuid = $evidence->getReport();
            if($reportUuid !== null && $reportUuid !== '')
            {
                $sources[] = fn(int $page): array => $client->listReportEvidenceRecords($reportUuid, $page, 100, $includeConfidential);
            }
            if($evidence->getEntityUuid() !== '')
            {
                $sources[] = fn(int $page): array => $client->listEntityEvidenceRecords($evidence->getEntityUuid(), $page, 100, $includeConfidential);
            }

            foreach($sources as $source)
            {
                for($page = 1; $page <= self::EVIDENCE_METADATA_LOOKUP_PAGES; $page++)
                {
                    try
                    {
                        $records = $source($page);
                    }
                    catch(\Exception $exception)
                    {
                        Logger::getLogger()->warning('Unable to look up evidence metadata', $exception);
                        break;
                    }

                    foreach($records as $record)
                    {
                        if($record->getUuid() === $evidence->getUuid())
                        {
                            return empty($record->getMetadata()) ? $evidence : $record;
                        }
                    }

                    if(count($records) < 100)
                    {
                        break;
                    }
                }
            }

            return $evidence;
        }
    }
