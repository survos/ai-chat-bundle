<?php

declare(strict_types=1);

namespace Survos\AiChatBundle\Twig;

use Survos\AiChatBundle\Mcp\McpToolCatalog;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

/**
 * `mcp_tools(server)` for @SurvosAiChat/mcp_connect.html.twig: the server's tools as
 * `{name, title, description, readOnly}`, straight from its MCP registry.
 */
final class McpConnectExtension extends AbstractExtension
{
    public function __construct(private readonly McpToolCatalog $catalog)
    {
    }

    public function getFunctions(): array
    {
        return [
            new TwigFunction('mcp_tools', $this->catalog->tools(...)),
            new TwigFunction('mcp_server_exists', $this->catalog->isAvailable(...)),
        ];
    }
}
