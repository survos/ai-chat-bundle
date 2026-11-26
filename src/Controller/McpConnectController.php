<?php

declare(strict_types=1);

namespace Survos\AiChatBundle\Controller;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Twig\Environment;

/** The "Connect your own AI agent" page for the app's MCP server, from survos_ai_chat.connect (see the README). */
final readonly class McpConnectController
{
    /** @param array<string, mixed> $connect */
    public function __construct(private Environment $twig, #[Autowire(param: 'survos_ai_chat.connect')] private array $connect)
    {
    }

    #[Route('/ask/connect', name: 'survos_ai_chat_connect', methods: ['GET'])]
    public function __invoke(Request $request): Response
    {
        if (!isset($this->connect['name'])) {
            throw new NotFoundHttpException('Set survos_ai_chat.connect.name (and server) to show the MCP connect page.');
        }

        return new Response($this->twig->render('@SurvosAiChat/connect_page.html.twig', [
            'page' => $this->connect + ['url' => $request->getSchemeAndHttpHost()],
        ]));
    }
}
