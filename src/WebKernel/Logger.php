<?php

    namespace WebKernel;

    /**
     * Provides the shared web application logger.
     */
    class Logger
    {
        private static ?\LogLib2\Logger $logger = null;

        /**
         * Retrieve the shared web application logger.
         *
         * @return \LogLib2\Logger Configured LogLib2 logger instance.
         */
        public static function getLogger(): \LogLib2\Logger
        {
            if(self::$logger === null)
            {
                self::$logger = new \LogLib2\Logger('net.nosial.federationweb');
            }

            return self::$logger;
        }
    }