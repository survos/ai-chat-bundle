<?php

declare(strict_types=1);

namespace Survos\AiChatBundle;

use Survos\AiChatBundle\Service\MattermostService;
use Survos\Kit\AbstractSurvosBundle;
use Survos\Kit\SurvosKitBundle;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Kernel\RequiredBundle;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;

/**
 * Exposes the host app's Symfony AI agents to chat platforms.
 *
 * Two surfaces (see PLAN.md):
 *   v1  OpenAI-compatible POST /v1/chat/completions — the bundle owns transport,
 *       auth and routing; the app supplies a thin ChatAgentResolverInterface.
 *   v2  MCP tools (after symfony/ai 0.11; relates to survos/mcp-bundle).
 *
 * Shipping now: the communications layer only — an `mm:post` demo command that
 * posts to a Mattermost instance via the Symfony Mattermost notifier, to prove
 * the chat plumbing before any agent is wired.
 */
#[RequiredBundle(SurvosKitBundle::class)]
// Symfony\Component\HttpKernel\Bundle\Bundle <-- Flex auto-registration marker (see Survos\Kit\AbstractSurvosBundle)
final class SurvosAiChatBundle extends AbstractSurvosBundle
{
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        // Auto-scans src/Command and src/Controller.
        parent::loadExtension($config, $container, $builder);

        // The command lives in src/Service (it's a service first, CLI second —
        // see CONVENTIONS.md), so register it explicitly to bind the default channel.
        $container->services()
            ->set(MattermostService::class)
            ->autowire()
            ->autoconfigure()
            ->arg('$defaultChannel', '%env(default::MM_DEFAULT_CHANNEL)%');
    }
}
