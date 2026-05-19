import i18n from '../i18n';

export type SlashCommand = {
  name: string;
  description: string;
  usage: string;
  execute: (args: string, context: SlashCommandContext) => void | Promise<void>;
};

export type SlashCommandContext = {
  onContinue: () => void;
  onRegenerate: (messageId: string) => void;
  onImpersonate: () => void;
  onSummarize: () => void;
  onSetAuthorNote: (note: string) => void;
  onSendSystemMessage: (content: string) => void;
  lastAssistantMessageId: string | null;
};

const commands: Map<string, SlashCommand> = new Map();

// Register built-in commands
function register(cmd: SlashCommand) {
  commands.set(cmd.name, cmd);
}

register({
  name: 'continue',
  description: i18n.t('commands.continue.description'),
  usage: i18n.t('commands.continue.usage'),
  execute: (_args, ctx) => ctx.onContinue(),
});

register({
  name: 'regenerate',
  description: i18n.t('commands.regenerate.description'),
  usage: i18n.t('commands.regenerate.usage'),
  execute: (_args, ctx) => {
    if (ctx.lastAssistantMessageId) ctx.onRegenerate(ctx.lastAssistantMessageId);
  },
});

register({
  name: 'regen',
  description: i18n.t('commands.regenerateAlias.description'),
  usage: i18n.t('commands.regenerateAlias.usage'),
  execute: (_args, ctx) => {
    if (ctx.lastAssistantMessageId) ctx.onRegenerate(ctx.lastAssistantMessageId);
  },
});

register({
  name: 'impersonate',
  description: i18n.t('commands.impersonate.description'),
  usage: i18n.t('commands.impersonate.usage'),
  execute: (_args, ctx) => ctx.onImpersonate(),
});

register({
  name: 'summarize',
  description: i18n.t('commands.summarize.description'),
  usage: i18n.t('commands.summarize.usage'),
  execute: (_args, ctx) => ctx.onSummarize(),
});

register({
  name: 'sys',
  description: i18n.t('commands.system.description'),
  usage: i18n.t('commands.system.usage'),
  execute: (args, ctx) => {
    if (args.trim()) ctx.onSendSystemMessage(args.trim());
  },
});

register({
  name: 'note',
  description: i18n.t('commands.setNote.description'),
  usage: i18n.t('commands.setNote.usage'),
  execute: (args, ctx) => ctx.onSetAuthorNote(args.trim()),
});

export function parseSlashCommand(input: string): { command: SlashCommand; args: string } | null {
  if (!input.startsWith('/')) return null;
  const spaceIdx = input.indexOf(' ');
  const name = spaceIdx === -1 ? input.slice(1) : input.slice(1, spaceIdx);
  const args = spaceIdx === -1 ? '' : input.slice(spaceIdx + 1);
  const cmd = commands.get(name.toLowerCase());
  return cmd ? { command: cmd, args } : null;
}

export function getAllCommands(): SlashCommand[] {
  return Array.from(commands.values());
}

export function searchCommands(query: string): SlashCommand[] {
  const lower = query.toLowerCase();
  return getAllCommands().filter(c =>
    c.name.includes(lower) || c.description.toLowerCase().includes(lower)
  );
}
