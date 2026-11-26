<?php

declare(strict_types=1);

namespace Survos\AiChatBundle;

use Survos\AiChatBundle\Mcp\McpToolCatalog;
use Survos\AiChatBundle\Service\MattermostService;
use Survos\AiChatBundle\Twig\McpConnectExtension;
use Survos\Kit\AbstractUxBundle;
use Survos\Kit\Routing\ConfigurableRoutesInterface;
use Survos\Kit\SurvosKitBundle;
use Survos\Kit\Traits\HasConfigurableRoutes;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Kernel\RequiredBundle;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;

use function Symfony\Component\DependencyInjection\Loader\Configurator\service;

/**
 * Exposes the host app's Symfony AI agents to chat platforms.
 *
 * Two surfaces (see PLAN.md):
 *   v1  OpenAI-compatible POST /v1/chat/completions — the bundle owns transport,
 *       auth and routing; the app supplies a thin ChatAgentResolverInterface.
 *   v2  MCP tools (after symfony/ai 0.11; relates to survos/mcp-bundle).
 *
 * Shipping now: the Mattermost `mm:post` demo and a reusable Twig/Stimulus
 * browser composer. Host applications own retrieval and conversation storage.
 */
#[RequiredBundle(SurvosKitBundle::class)]
// Symfony\Component\HttpKernel\Bundle\Bundle <-- Flex auto-registration marker (see Survos\Kit\AbstractSurvosBundle)
final class SurvosAiChatBundle extends AbstractUxBundle implements ConfigurableRoutesInterface
{
    use HasConfigurableRoutes;

    public function configure(DefinitionConfigurator $definition): void
    {
        $children = $definition->rootNode()->children();
        $this->addRouteOptions($children, '');
        $children
            ->variableNode('connect')->defaultValue([])
                ->info('Variables of @SurvosAiChat/mcp_connect.html.twig for the page at /ask/connect: name (required), server, lead, prompt, ... (see the README).')
            ->end()
        ->end();
    }

    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        // Auto-scans src/Command and src/Controller; HasConfigurableRoutes wires the controller routes.
        parent::loadExtension($config, $container, $builder);
        $builder->setParameter('survos_ai_chat.connect', $config['connect']);

        // The command lives in src/Service (it's a service first, CLI second —
        // see CONVENTIONS.md), so register it explicitly to bind the default channel.
        // It needs a notifier chatter; process() drops it when the app has none.
        $container->services()
            ->set(MattermostService::class)
            ->autowire()
            ->autoconfigure()
            ->arg('$defaultChannel', '%env(default::MM_DEFAULT_CHANNEL)%');

        // The tool list of @SurvosAiChat/mcp_connect.html.twig, read from symfony/mcp-bundle's
        // per-server registries when that bundle is installed (null references otherwise).
        $container->services()
            ->set(McpToolCatalog::class)
            ->args([
                service('mcp.server_locator.builder')->nullOnInvalid(),
                service('mcp.server_locator.registry')->nullOnInvalid(),
            ]);
        if (class_exists(\Twig\Extension\AbstractExtension::class)) {
            $container->services()
                ->set(McpConnectExtension::class)
                ->autowire()
                ->tag('twig.extension');
        }
    }

    /** Apps without a notifier chatter (no chatter_transports) get no mm:post instead of a broken container. */
    public function process(ContainerBuilder $container): void
    {
        parent::process($container);

        if (!$container->has('chatter')) {
            $container->removeDefinition(MattermostService::class);
        }
    }
}
