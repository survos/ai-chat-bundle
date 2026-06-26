<?php

declare(strict_types=1);

namespace Survos\AiChatBundle\Contract;

use Symfony\AI\Agent\AgentInterface;

/**
 * The per-app callback seam (v1, not yet wired — see PLAN.md).
 *
 * The bundle owns the OpenAI-compatible /v1/chat/completions transport, auth and
 * persona routing. The ONLY app-specific thing is which agent answers a given
 * request, so each app ships one service implementing this interface. The bundle
 * never imports app concepts (folio, museado, personas); it just calls resolve().
 *
 * Example (zm): map model "curator" → the existing ai.agent.folio agent.
 */
interface ChatAgentResolverInterface
{
    /**
     * Resolve the inbound OpenAI request to the agent that should answer it.
     *
     * @param string               $model   the OpenAI "model" field — used as the
     *                                       persona/tenant key, e.g. "curator" or
     *                                       "museado/curator@walters"
     * @param array<string, mixed> $context any extra routing context the transport
     *                                       extracted (headers, bearer subject, …)
     *
     * @return AgentInterface|null the agent to run, or null if this resolver does
     *                             not handle the given model
     */
    public function resolve(string $model, array $context = []): ?AgentInterface;
}
