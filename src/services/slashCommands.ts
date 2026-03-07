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
  description: 'Continue the last response',
  usage: '/continue',
  execute: (_args, ctx) => ctx.onContinue(),
});

register({
  name: 'regenerate',
  description: 'Regenerate the last response',
  usage: '/regenerate',
  execute: (_args, ctx) => {
    if (ctx.lastAssistantMessageId) ctx.onRegenerate(ctx.lastAssistantMessageId);
  },
});

register({
  name: 'regen',
  description: 'Regenerate the last response (alias)',
  usage: '/regen',
  execute: (_args, ctx) => {
    if (ctx.lastAssistantMessageId) ctx.onRegenerate(ctx.lastAssistantMessageId);
  },
});

register({
  name: 'impersonate',
  description: 'Generate a message as the user',
  usage: '/impersonate',
  execute: (_args, ctx) => ctx.onImpersonate(),
});

register({
  name: 'summarize',
  description: 'Summarize the conversation',
  usage: '/summarize',
  execute: (_args, ctx) => ctx.onSummarize(),
});

register({
  name: 'sys',
  description: 'Send a system message',
  usage: '/sys <message>',
  execute: (args, ctx) => {
    if (args.trim()) ctx.onSendSystemMessage(args.trim());
  },
});

register({
  name: 'note',
  description: "Set the author's note",
  usage: '/note <text>',
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
