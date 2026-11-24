<?php

declare(strict_types=1);

namespace Survos\AiChatBundle\Mcp;

use Psr\Container\ContainerInterface;

/**
 * The tools a symfony/mcp-bundle server exposes, read from its own registry, so a page that
 * documents the server cannot list a tool the server lacks or miss one it has.
 *
 * The locators are the ones symfony/mcp-bundle registers (`mcp.server_locator.builder` and
 * `mcp.server_locator.registry`); without that bundle both are null and the catalog is empty.
 */
final class McpToolCatalog
{
    /** @var array<string, list<array{name: string, title: ?string, description: ?string, readOnly: ?bool}>> */
    private array $tools = [];

    public function __construct(
        private readonly ?ContainerInterface $builders = null,
        private readonly ?ContainerInterface $registries = null,
    ) {
    }

    public function isAvailable(string $server): bool
    {
        return null !== $this->builders && null !== $this->registries
            && $this->builders->has($server) && $this->registries->has($server);
    }

    /**
     * @return list<array{name: string, title: ?string, description: ?string, readOnly: ?bool}>
     */
    public function tools(string $server): array
    {
        if (isset($this->tools[$server])) {
            return $this->tools[$server];
        }
        if (!$this->isAvailable($server)) {
            throw new \InvalidArgumentException(\sprintf('No MCP server "%s" is configured (symfony/mcp-bundle, mcp.servers).', $server));
        }

        // As debug:mcp does: the loaders fill the registry when the server is built.
        $this->builders->get($server)->build();
        $tools = [];
        foreach ($this->registries->get($server)->getTools() as $tool) {
            $tools[] = [
                'name' => $tool->name,
                'title' => $tool->title,
                'description' => $tool->description,
                'readOnly' => $tool->annotations?->readOnlyHint,
            ];
        }

        return $this->tools[$server] = $tools;
    }
}
