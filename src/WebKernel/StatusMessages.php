<?php

    namespace WebKernel;

    /**
     * Request status metadata used to render feedback after a redirect.
     */
    final readonly class StatusMessages
    {
        /**
         * @param string|null $successMessageKey Localization key supplied by the success query parameter.
         * @param string|null $errorMessageKey Localization key supplied by the error query parameter.
         * @param string|null $errorDetail Unlocalized detail supplied by the error_message query parameter.
         */
        public function __construct(
            public ?string $successMessageKey,
            public ?string $errorMessageKey,
            public ?string $errorDetail,
        )
        {
        }
    }
