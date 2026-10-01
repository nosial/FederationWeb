<?php

namespace WebKernel;

use DynamicalWeb\Enums\RequestMethod;
use DynamicalWeb\WebSession;
use Exception;
use FederationLib\Enums\IncidentType;
use FederationLib\FederationClient;
use FederationLib\Objects\ContentInput;
use FederationLib\Objects\EntityRecord;

/**
 * Handles report submission requests and their evidence attachments.
 */
class ReportSubmissionView
{
    private FederationClient $federationClient;

    /**
     * ReportSubmissionView constructor.
     */
    public function __construct()
    {
        $this->federationClient = WebSession::get('federation_client');
    }

    /**
     * Processes entity searches and report submissions.
     */
    public function handlePostRequest(): void
    {
        $request = WebSession::getRequest();
        $action = $request->getParameter('action');
        if ($action === 'search_entities')
        {
            $query = $request->getParameter('query', '');
            try
            {
                $results = $this->federationClient->searchEntities($query, 1, 10);
                $data = array_map(static function (EntityRecord $entity): array
                {
                    return [
                        'uuid' => $entity->getUuid(),
                        'address' => $entity->getAddress(),
                        'host' => $entity->getHost(),
                        'id' => $entity->getId()
                    ];
                }, $results);
                Utilities::respondWithJson(['results' => $data]);
            }
            catch (Exception $exception)
            {
                Logger::getLogger()->warning('Unable to search entities for report submission', $exception);
                Utilities::respondWithJson(['results' => [], 'error' => $exception->getMessage()]);
            }
        }
        if ($action !== 'submit_report')
        {
            return;
        }

        $entityIdentifier = $request->getParameter('entity_identifier');
        $newEntityAddress = $request->getParameter('new_entity_address');
        $reportMessage = $request->getParameter('report_message');
        $evidenceInputs = $_POST['evidence'] ?? null;
        $evidenceRecords = is_array($evidenceInputs)
            ? array_values(array_filter($evidenceInputs, static fn($evidence): bool => is_array($evidence) && trim((string)($evidence['content'] ?? '')) !== ''))
            : [['content' => $request->getParameter('content'), 'note' => null, 'tag' => $request->getParameter('evidence_tag'), 'confidential' => false]];
        $incidentType = IncidentType::tryFrom($request->getParameter('incident_type') ?? '');
        if (empty($entityIdentifier) && !empty($newEntityAddress))
        {
            $entityIdentifier = $newEntityAddress;
        }

        if (empty($entityIdentifier) || empty($evidenceRecords) || $incidentType === null)
        {
            Utilities::redirect('reports');
        }

        if ($incidentType === IncidentType::ILLEGAL_CONTENT && !$this->isIllegalContentAllowed())
        {
            Utilities::redirect('reports', queryParameters: ['error' => 'report_illegal_content_not_allowed']);
        }

        $evidence = array_map(static fn(array $evidenceInput): ContentInput => new ContentInput(
            textContent: (string)$evidenceInput['content'],
            tag: !empty($evidenceInput['tag']) ? (string)$evidenceInput['tag'] : null,
            confidential: $incidentType === IncidentType::ILLEGAL_CONTENT
        ), $evidenceRecords);

        try
        {
            $submission = $this->federationClient->submitReport($entityIdentifier, $evidence, $incidentType, !empty($reportMessage) ? $reportMessage : null);
        }
        catch (Exception $exception)
        {
            Logger::getLogger()->warning('Unable to submit report', $exception);
            Utilities::redirect('reports', queryParameters: ['error' => 'report_submit_failed', 'error_message' => $exception->getMessage()]);
        }

        $this->uploadAttachments($submission->getEvidence()[0]->getUuid());
        Utilities::redirect('report_detail', pathVariables: ['report_uuid' => $submission->getReport()->getUuid()], queryParameters: ['success' => 'report_submitted']);
    }

    /**
     * Checks whether the server accepts reports with the ILLEGAL_CONTENT incident type. When the server information
     * cannot be read, the report is left for the server to accept or reject.
     *
     * @return bool False only when the server publishes that it does not accept illegal content.
     */
    private function isIllegalContentAllowed(): bool
    {
        try
        {
            return $this->federationClient->getServerInformation()->isAllowIllegalContent();
        }
        catch (Exception $exception)
        {
            Logger::getLogger()->warning('Unable to read server information for report submission', $exception);
            return true;
        }
    }

    /**
     * Uploads submitted file attachments for an evidence record.
     *
     * @param string $evidenceUuid The UUID of the evidence that receives the attachments.
     */
    private function uploadAttachments(string $evidenceUuid): void
    {
        if (!isset($_FILES['files']) || !is_array($_FILES['files']['tmp_name']))
        {
            return;
        }

        foreach ($_FILES['files']['tmp_name'] as $index => $tmpPath)
        {
            if ($_FILES['files']['error'][$index] !== UPLOAD_ERR_OK || !is_file($tmpPath) || filesize($tmpPath) <= 0)
            {
                continue;
            }
            try
            {
                $this->federationClient->uploadFileAttachment($evidenceUuid, $tmpPath, $_FILES['files']['name'][$index] ?? null);
            }
            catch (Exception $exception)
            {
                Logger::getLogger()->warning('Unable to upload report attachment', $exception);
            }
        }
    }
}
