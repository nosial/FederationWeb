<?php

    namespace WebKernel;

    use DynamicalWeb\WebSession;
    use FederationLib\Objects\ServerInformation;

    /**
     * The document metadata of the page being rendered: its title, description, canonical address and
     * whether search engines may index it. A page describes itself with {@see PageMetadata::set()} before
     * its head is rendered, and sections/head.phtml renders the title, the description, the Open Graph
     * and Twitter link-preview tags and the structured data from it.
     *
     * <p>Link previews are fetched by crawlers without a session, so they describe the page as an
     * anonymous visitor sees it; pages the server does not make public preview as the sign-in page.
     */
    final class PageMetadata
    {
        /**
         * The name used when the connected server's name is unknown, matching apple-mobile-web-app-title.
         */
        public const string APPLICATION_NAME = 'Federation';

        /**
         * Descriptions are shortened to this many characters, the length search results and previews show.
         */
        private const int DESCRIPTION_LENGTH = 160;

        /**
         * The Open Graph locale of each application locale.
         */
        private const array OPEN_GRAPH_LOCALES = [
            'en' => 'en_US',
            'cn' => 'zh_CN',
            'es' => 'es_ES',
            'ru' => 'ru_RU',
        ];

        private const string SESSION_KEY = 'page_metadata';

        private string $title;
        private ?string $description;
        private bool $indexable;
        private ?string $canonicalUrl;

        private function __construct(string $title, ?string $description, bool $indexable, ?string $canonicalUrl)
        {
            $this->title = $title;
            $this->description = $description;
            $this->indexable = $indexable;
            $this->canonicalUrl = $canonicalUrl;
        }

        /**
         * Describes the page being rendered.
         *
         * @param string $title The page title, without the site name which is added to the document title.
         * @param string|null $description A summary of the page, or null for the site description.
         * @param bool $indexable False for pages search engines should not index, such as print documents,
         *                        search results and error pages.
         * @param string|null $canonicalUrl The page's canonical address, or null for the requested address
         *                                  without its query string.
         */
        public static function set(string $title, ?string $description=null, bool $indexable=true, ?string $canonicalUrl=null): void
        {
            WebSession::set(self::SESSION_KEY, new self($title, $description, $indexable, $canonicalUrl));
        }

        /**
         * Returns the metadata of the page being rendered, or the site's own metadata when the page did
         * not describe itself.
         */
        public static function current(): self
        {
            $metadata = WebSession::get(self::SESSION_KEY);
            return $metadata instanceof self ? $metadata : new self(self::getSiteName(), null, true, null);
        }

        /**
         * Returns the name of the connected server, or the application name when it is unknown.
         */
        public static function getSiteName(): string
        {
            $serverInformation = WebSession::get('server_information');
            if ($serverInformation instanceof ServerInformation && trim($serverInformation->getServerName()) !== '')
            {
                return trim($serverInformation->getServerName());
            }

            return self::APPLICATION_NAME;
        }

        /**
         * Returns the page title, without the site name.
         */
        public function getTitle(): string
        {
            return self::normalize($this->title);
        }

        /**
         * Returns the document title: the page title followed by the site name.
         */
        public function getDocumentTitle(): string
        {
            $title = $this->getTitle();
            $siteName = self::getSiteName();

            return $title === '' || $title === $siteName ? $siteName : $title . ' - ' . $siteName;
        }

        /**
         * Returns the page description, or the site description, shortened to the length search results show.
         */
        public function getDescription(): string
        {
            $description = self::normalize($this->description ?? '');
            if ($description === '')
            {
                $description = self::normalize(self::localize('meta_description_site', ['server_name' => self::getSiteName()]));
            }

            if (mb_strlen($description) > self::DESCRIPTION_LENGTH)
            {
                $description = rtrim(mb_substr($description, 0, self::DESCRIPTION_LENGTH - 1)) . '…';
            }

            return $description;
        }

        /**
         * Returns whether search engines may index the page.
         */
        public function isIndexable(): bool
        {
            return $this->indexable;
        }

        /**
         * Returns the page's absolute canonical address.
         */
        public function getCanonicalUrl(): string
        {
            return $this->canonicalUrl ?? self::getBaseUrl() . WebSession::getRequest()->getPath();
        }

        /**
         * Returns the absolute address of the site's home page.
         */
        public function getSiteUrl(): string
        {
            return self::getBaseUrl() . '/';
        }

        /**
         * Returns the absolute address of the image shown in link previews.
         */
        public function getImageUrl(): string
        {
            return self::getBaseUrl() . '/favicon/web-app-manifest-512x512.png';
        }

        /**
         * Returns the Open Graph locale of the session's locale, for example en_US.
         */
        public function getOpenGraphLocale(): string
        {
            return self::OPEN_GRAPH_LOCALES[$this->getLanguage()] ?? 'en_US';
        }

        /**
         * Returns the session's locale code, for example en.
         */
        public function getLanguage(): string
        {
            return WebSession::getLocale()?->getLocaleCode() ?? 'en';
        }

        /**
         * Returns the schema.org structured data describing the page and the site it belongs to.
         */
        public function getStructuredData(): array
        {
            return [
                '@context' => 'https://schema.org',
                '@type' => 'WebPage',
                'name' => $this->getTitle(),
                'description' => $this->getDescription(),
                'url' => $this->getCanonicalUrl(),
                'inLanguage' => $this->getLanguage(),
                'isPartOf' => [
                    '@type' => 'WebSite',
                    'name' => self::getSiteName(),
                    'url' => $this->getSiteUrl(),
                ],
            ];
        }

        /**
         * Returns the scheme and host of the request, as route addresses are built.
         */
        private static function getBaseUrl(): string
        {
            $request = WebSession::getRequest();
            return ($request->isSecure() ? 'https' : 'http') . '://' . rtrim($request->getHost(), '/');
        }

        /**
         * Returns a string from the global locale section, or an empty string when it is not defined.
         */
        private static function localize(string $key, array $parameters=[]): string
        {
            return WebSession::getLocale()?->getString('global', $key, $parameters) ?? '';
        }

        /**
         * Collapses whitespace and line breaks, as record messages can span several lines.
         */
        private static function normalize(string $text): string
        {
            return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
        }
    }
