<?php

namespace WebKernel;

use DynamicalWeb\Enums\RequestMethod;
use DynamicalWeb\WebSession;
use FederationLib\Enums\IncidentType;
use FederationLib\FederationClient;
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
        if ($action === 'search_entities') {
            $query = $request->getParameter('query', '');
            try {
                $results = $this->federationClient->searchEntities($query, 1, 10);
                $data = array_map(static function (EntityRecord $entity): array {
                    return ['uuid' => $entity->getUuid(), 'address' => $entity->getAddress(), 'host' => $entity->getHost(), 'id' => $entity->getId()];
                }, $results);
                Utilities::respondWithJson(['results' => $data]);
            } catch (\Exception $exception) {
                Logger::getLogger()->warning('Unable to search entities for report submission', $exception);
                Utilities::respondWithJson(['results' => [], 'error' => $exception->getMessage()]);
            }
        }
        if ($action !== 'submit_report') {
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
        if (empty($entityIdentifier) && !empty($newEntityAddress)) {
            $entityIdentifier = $newEntityAddress;
        }

        if (empty($entityIdentifier) || empty($evidenceRecords) || $incidentType === null) {
            Utilities::redirect('reports');
        }

        try {
            $firstEvidence = $evidenceRecords[0];
            $submission = $this->federationClient->submitReport($entityIdentifier, $firstEvidence['content'], $incidentType, !empty($reportMessage) ? $reportMessage : null, !empty($firstEvidence['tag']) ? $firstEvidence['tag'] : null);
            foreach (array_slice($evidenceRecords, 1) as $evidenceInput) {
                $evidence = $this->federationClient->submitEvidence($entityIdentifier, $evidenceInput['content'], null, !empty($evidenceInput['tag']) ? $evidenceInput['tag'] : null, false);
                $this->federationClient->addEvidenceToReport($evidence->getUuid(), $submission->getReport()->getUuid());
            }
            $this->uploadAttachments($submission->getEvidence()->getUuid());
            Utilities::redirect('report_detail', pathVariables: ['report_uuid' => $submission->getReport()->getUuid()], queryParameters: ['success' => 'report_submitted']);
        } catch (\Exception $exception) {
            Logger::getLogger()->warning('Unable to submit report', $exception);
            Utilities::redirect('reports');
        }
    }

    /**
     * Uploads submitted file attachments for an evidence record.
     *
     * @param string $evidenceUuid The UUID of the evidence that receives the attachments.
     */
    private function uploadAttachments(string $evidenceUuid): void
    {
        if (!isset($_FILES['files']) || !is_array($_FILES['files']['tmp_name'])) {
            return;
        }
        foreach ($_FILES['files']['tmp_name'] as $index => $tmpPath) {
            if ($_FILES['files']['error'][$index] !== UPLOAD_ERR_OK || !is_file($tmpPath) || filesize($tmpPath) <= 0) {
                continue;
            }
            try {
                $this->federationClient->uploadFileAttachment($evidenceUuid, $tmpPath, $_FILES['files']['name'][$index] ?? null);
            } catch (\Exception $exception) {
                Logger::getLogger()->warning('Unable to upload report attachment', $exception);
            }
        }
    }
}
