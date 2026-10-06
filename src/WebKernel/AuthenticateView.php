<?php

namespace WebKernel;

use DynamicalWeb\Enums\RequestMethod;
use DynamicalWeb\Html\Functions;
use DynamicalWeb\Objects\CookieSession;
use DynamicalWeb\WebSession;
use FederationLib\FederationClient;
use FederationLib\Objects\ServerInformation;

/**
 * Handles authentication form state and sign-in requests.
 */
class AuthenticateView
{
    private const array LOCALES = [
        ['code' => 'en', 'label' => 'English', 'flag' => 'gb'],
        ['code' => 'cn', 'label' => '中文', 'flag' => 'cn'],
        ['code' => 'es', 'label' => 'Español', 'flag' => 'es'],
        ['code' => 'ru', 'label' => 'Русский', 'flag' => 'ru'],
    ];


    private ?CookieSession $cookieSession;

    /**
     * AuthenticateView constructor.
     */
    public function __construct()
    {
        $this->cookieSession = WebSession::get('cookie_session');
    }


    /**
     * Returns whether dark mode is enabled for the current session.
     *
     * @return bool Whether dark mode is enabled.
     */
    public function getDarkMode(): bool
    {
        return $this->cookieSession ? (bool)$this->cookieSession->get('dark_mode', true) : true;
    }


    /**
     * Determines whether selecting a custom federation server is disabled.
     *
     * @return bool Whether custom federation servers are disabled.
     */
    public function isCustomHostDisabled(): bool
    {
        return self::isConfigured('FEDERATION_DISABLE_CUSTOM_HOST');
    }

    /**
     * Determines whether anonymous authentication is disabled.
     *
     * @return bool Whether anonymous authentication is disabled.
     */
    public function isAnonymousDisabled(): bool
    {
        return self::isConfigured('FEDERATION_DISABLE_ANONYMOUS');
    }

    /**
     * Returns the configured default federation server endpoint.
     *
     * @return string|false The endpoint, or false when it is not configured.
     */
    public function getDefaultServerEndpoint(): string|false
    {
        return getenv('FEDERATION_SERVER_ENDPOINT');
    }

    /**
     * Returns the locale code for the current web session.
     *
     * @return string The current locale code.
     */
    public function getCurrentLocale(): string
    {
        return WebSession::getLocale()?->getLocaleCode() ?? 'en';
    }

    /**
     * Returns the locales available from the authentication form.
     *
     * @return array<int, array{code: string, label: string, flag: string}> Available locale definitions.
     */
    public function getLocales(): array
    {
        return self::LOCALES;
    }

    /**
     * Returns the path to restore after authentication.
     *
     * @return string The current route path.
     */
    public function getReturnPath(): string
    {
        return WebSession::getCurrentRoute()->getPath();
    }

    /**
     * Returns the authentication error passed on by the redirect to this page.
     *
     * @return string|null The error code, if present.
     */
    public function getError(): ?string
    {
        return Utilities::getRedirectStatus('error');
    }

    /**
     * Processes an authentication form submission and redirects to its result.
     */
    public function handlePostRequest(): void
    {
        $request = WebSession::getRequest();
        $serverHost = $request->getParameter('server_host');
        $apiKey = $request->getParameter('api_key');
        $disableCustomHost = self::isConfigured('FEDERATION_DISABLE_CUSTOM_HOST');
        $disableAnonymous = self::isConfigured('FEDERATION_DISABLE_ANONYMOUS');
        $defaultServerEndpoint = getenv('FEDERATION_SERVER_ENDPOINT');

        if ($disableCustomHost || empty($serverHost)) {
            $serverHost = $defaultServerEndpoint;
        }

        // The web server connects to whatever host is given, so accept only an HTTP(S) URL: not a
        // file:// or other scheme the HTTP client would otherwise attempt, and not nothing at all
        // when no default endpoint is configured.
        $serverHost = is_string($serverHost) ? trim($serverHost) : '';
        $scheme = strtolower((string)parse_url($serverHost, PHP_URL_SCHEME));
        if ($serverHost === '' || !in_array($scheme, ['http', 'https'], true) || empty(parse_url($serverHost, PHP_URL_HOST))) {
            Utilities::redirect('authenticate', queryParameters: ['error' => 'server_unreachable']);
        }

        try {
            $federationClient = new FederationClient($serverHost);
            $serverInfo = $federationClient->getServerInformation();
        } catch (\Exception $exception) {
            Logger::getLogger()->warning('Unable to retrieve server information', $exception);
            Utilities::redirect('authenticate', queryParameters: ['error' => 'server_unreachable']);
        }

        if (empty($apiKey)) {
            if ($disableAnonymous) {
                Utilities::redirect('authenticate', queryParameters: ['error' => 'anonymous_disabled']);
            }
            $this->authenticate($federationClient, $serverInfo, null, null, false, false, false, true, $serverHost, $defaultServerEndpoint);
        }

        try {
            $federationClient->setAccessToken($apiKey);
            $self = $federationClient->getSelf();
        } catch (\Exception $exception) {
            Logger::getLogger()->warning('Unable to authenticate operator', $exception);
            Utilities::redirect('authenticate', queryParameters: ['error' => 'invalid_key']);
        }

        if ($self->isDisabled()) {
            Utilities::redirect('authenticate', queryParameters: ['error' => 'disabled_operator']);
        }

        $this->authenticate(
            $federationClient,
            $serverInfo,
            $apiKey,
            $self->getName(),
            $self->hasClientPermissions(),
            $self->hasManagementPermissions(),
            $self->hasOperatorPermissions(),
            false,
            $serverHost,
            $defaultServerEndpoint,
            $self->getUuid()
        );
    }

    /**
     * Persists authenticated operator details and redirects to the dashboard.
     *
     * @param FederationClient $federationClient The authenticated federation client.
     * @param ServerInformation $serverInfo The connected server information.
     * @param string|null $apiKey The operator API key, if supplied.
     * @param string|null $operatorName The authenticated operator name, if applicable.
     * @param bool $isClient Whether the operator has client permissions.
     * @param bool $canManageBlacklist Whether the operator can manage blacklist entries.
     * @param bool $canManageOperators Whether the operator can manage operators.
     * @param bool $anonymous Whether the session is anonymously authenticated.
     * @param string $serverHost The server endpoint used for authentication.
     * @param string|false $defaultServerEndpoint The configured default server endpoint.
     * @param string|null $operatorUuid The authenticated operator UUID, if applicable.
     */
    private function authenticate(FederationClient $federationClient, ServerInformation $serverInfo, ?string $apiKey, ?string $operatorName, bool $isClient, bool $canManageBlacklist, bool $canManageOperators, bool $anonymous, string $serverHost, string|false $defaultServerEndpoint, ?string $operatorUuid = null): void
    {
        /** @var CookieSession $cookieSession */
        $cookieSession = WebSession::get('cookie_session');

        // Signing in starts a new session so that a session ID known before sign-in (for example
        // one planted in the browser) never becomes an authenticated session; it also issues a new
        // CSRF token. Only the display preference is carried over.
        $darkMode = $cookieSession->get('dark_mode');
        WebSession::destroyCookieSession('web_session');
        $newSession = WebSession::createCookieSession(['authenticated' => false, 'api_key' => null], 'web_session');
        if ($newSession !== null) {
            $cookieSession = $newSession;
            if ($darkMode !== null) {
                $cookieSession->set('dark_mode', $darkMode);
            }
            WebSession::set('cookie_session', $cookieSession);
        }

        $cookieSession->set('authenticated', true);
        $cookieSession->set('api_key', $apiKey);
        $cookieSession->set('operator_name', $anonymous ? Utilities::localize('anonymous') : $operatorName);
        $cookieSession->set('operator_uuid', $operatorUuid);
        $cookieSession->set('is_client', $isClient);
        $cookieSession->set('can_manage_blacklist', $canManageBlacklist);
        $cookieSession->set('can_manage_operators', $canManageOperators);
        $cookieSession->set('is_anonymous', $anonymous);
        if ($serverHost !== $defaultServerEndpoint) {
            $cookieSession->set('server_host', $serverHost);
        }
        WebSession::set('federation_client', $federationClient);
        WebSession::set('server_information', $serverInfo);
        WebSession::saveCookieSession($cookieSession);
        Utilities::redirect('dashboard');
    }

    /**
     * Determines whether a non-empty environment variable is configured.
     *
     * @param string $name The environment variable name.
     * @return bool Whether the variable has a non-empty value.
     */
    private static function isConfigured(string $name): bool
    {
        $value = getenv($name);
        return $value !== false && $value !== '';
    }
}
