<?php

declare(strict_types=1);

namespace Survos\AiChatBundle\Service;

use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Notifier\Bridge\Mattermost\MattermostOptions;
use Symfony\Component\Notifier\ChatterInterface;
use Symfony\Component\Notifier\Message\ChatMessage;

/**
 * Talks to a Mattermost instance over the Symfony Mattermost notifier.
 *
 * This is the "prove the communications work" layer — no AI yet. The notifier
 * posts to Mattermost's REST API over https, so point MATTERMOST_DSN at an https
 * host (survos-sites/mattermost is deployed to Dokku at chat.survos.com; the
 * notifier hardcodes https:// and cannot reach a plain-http local docker).
 *
 *   mattermost://<ACCESS_TOKEN>@<HOST>?channel=<CHANNEL_ID>
 */
final class MattermostService
{
    public function __construct(
        private readonly ChatterInterface $chatter,
        private readonly ?string $defaultChannel = null,
    ) {
    }

    #[AsCommand('mm:post', 'Post a message to Mattermost to prove the chat plumbing works')]
    public function post(
        SymfonyStyle $io,
        #[Argument('Message to post')] string $message = 'Hello, Mattermost!',
        #[Argument('Channel id to post to (defaults to MM_DEFAULT_CHANNEL or the DSN channel)')] ?string $channel = null,
    ): int {
        $channel ??= $this->defaultChannel;

        $options = new MattermostOptions();
        if ($channel !== null && $channel !== '') {
            $options->recipient($channel);
        }

        try {
            $this->chatter->send(new ChatMessage($message, $options));
        } catch (\Throwable $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        $io->success(sprintf(
            'Posted to Mattermost%s: "%s"',
            $channel !== null && $channel !== '' ? sprintf(' (channel %s)', $channel) : '',
            $message,
        ));

        return Command::SUCCESS;
    }
}
