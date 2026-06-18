import { EventEmitter } from 'node:events';
import type { AgentCommandStatus } from '@prisma/client';

export interface AgentCommandEvent {
  commandId: string;
  correlationId: string;
  commandType: string;
  status: AgentCommandStatus;
  repositoryId?: string | null;
  success?: boolean;
  message?: string;
}

class AgentCommandEventBus extends EventEmitter {
  emitCommand(event: AgentCommandEvent) {
    this.emit('command', event);
  }

  subscribe(listener: (event: AgentCommandEvent) => void) {
    this.on('command', listener);
    return () => this.off('command', listener);
  }
}

export const agentCommandEvents = new AgentCommandEventBus();
