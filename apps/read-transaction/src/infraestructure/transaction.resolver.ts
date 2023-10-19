import { Controller } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { EventPattern, Payload } from "@nestjs/microservices";
import { TransactionEventHandler } from '../application/handlers/transaction-event.handler';
import { GetTransactionQuery } from '../application/queries/get-transaction.query';
import { GetTransactionDto } from './dto/get-transaction.dto';
import { MessageBrokerDto } from './dto/message-broker.dto';
import { TransactionEntity } from './entities/transaction.entity';

@Controller()
@Resolver(() => { TransactionEntity })
export class ReadTransactionResolver {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly transactionEventHandler: TransactionEventHandler) { }

  @Query(() => GetTransactionDto, { name: 'transaction' })
  async findOne(@Args('id') id: string) {
    return this.queryBus.execute(new GetTransactionQuery(id));
  }

  @EventPattern('transaction.created')
  createTransactionReadDB(@Payload() message: MessageBrokerDto<any>) {
    this.transactionEventHandler.createTransactionReadDB(message.content);
  }

  @EventPattern('transaction.validated')
  updateTransactionReadDB(@Payload() message: MessageBrokerDto<Object>) {
    this.transactionEventHandler.updateTransactionReadDB(message.content);
  }

}
