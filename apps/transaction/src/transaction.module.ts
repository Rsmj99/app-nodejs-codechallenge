import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { GraphQLModule } from '@nestjs/graphql';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisCache } from 'apollo-server-cache-redis';
import { join } from 'path';
import { CreateTransactionHandler } from './application/handlers/create-transaction.handler';
import { GetTransactionHandler } from './application/handlers/get-transaction.handler';
import { TransactionEventHandler } from './application/handlers/transaction-event.handler';
import { TransactionMongooseRepository, TransactionTypeOrmRepository } from './domain/repositories/transaction.repository';
import { MongooseRepository } from './infraestructure/repository/mongoose.repository';
import { TransactionEntity } from './infraestructure/entities/transaction.entity';
import { TransactionResolver } from './infraestructure/transaction.resolver';
import { Transaction, TransactionSchema } from './infraestructure/schemas/transaction.schema';
import { TypeOrmRepository } from './infraestructure/repository/type-orm.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema }
    ]),
    ConfigModule.forRoot({ expandVariables: true }),
    TypeOrmModule.forFeature([TransactionEntity]),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        useFactory: () => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              brokers: [process.env.BROKER],
              retry: {
                retries: 5, // Número máximo de reintentos
                multiplier: 2, // Factor multiplicador para los tiempos de espera entre reintentos
                initialRetryTime: 1000, // Tiempo de espera mínimo entre reintentos (en milisegundos)
                maxRetryTime: 3000, // Tiempo de espera máximo entre reintentos (en milisegundos)
                factor: 0.2, // Agregar aleatZoriedad a los tiempos de espera
              }
            },
            consumer: {
              groupId: process.env.GROUP_TRANSACTION
            }
          }
        }),
      }
    ]),
    CqrsModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      cache: new RedisCache({ host: process.env.HOST, port: Number(process.env.REDIS_PORT) }),
      plugins: [
        ApolloServerPluginCacheControl({ defaultMaxAge: 30 }),
        responseCachePlugin()
      ],
      autoSchemaFile: join(process.cwd(), 'apps/transaction/src/schema.gql'),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.HOST,
        port: Number(process.env.POSTGRES_PORT),
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        entities: [TransactionEntity],
        synchronize: true // Esto crea las tablas automáticamente (NO usar en producción)
      }),
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGO_URI,
      }),
    })
  ],
  providers: [TransactionResolver, CreateTransactionHandler, GetTransactionHandler, TransactionEventHandler,
    {
      provide: TransactionTypeOrmRepository,
      useClass: TypeOrmRepository,
    }, {
      provide: TransactionMongooseRepository,
      useClass: MongooseRepository,
    }],
  controllers: [TransactionResolver]
})
export class TransactionModule { }
