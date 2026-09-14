import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS, EventPayloadMap } from '@';
import { ContractsService } from './contracts.service';

@Injectable()
export class ContractsListener {
  private readonly logger = new Logger(ContractsListener.name);

  constructor(private readonly contractsService: ContractsService) {}

  // negotiation-approval (built after contracts) emits this once an
  // approver grants — this is the "whichever module builds that event"
  // wiring flagged as a gap in ContractsService's ALLOWED_TRANSITIONS
  // comment when contracts was first built.
  //
  // Swallows the "already approved"/"invalid transition" case: single-stage
  // MVP v0 can still have more than one approver assigned to a contract
  // over time, and only the first grant should actually move the contract —
  // later ones are a no-op, not a bug worth crashing an event listener over.
  @OnEvent(EVENTS.APPROVAL_GRANTED)
  async handleApprovalGranted(event: EventPayloadMap[typeof EVENTS.APPROVAL_GRANTED]): Promise<void> {
    try {
      await this.contractsService.changeStatus(event.tenantId, event.contractId, 'approved');
    } catch (error) {
      if (error instanceof BadRequestException) {
        this.logger.debug(
          `Ignoring approval.granted for contract ${event.contractId}: ${error.message}`,
        );
        return;
      }

      throw error;
    }
  }
}
