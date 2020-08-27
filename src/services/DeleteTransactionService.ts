import { getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';
import Transaction from '../models/Transaction';
import TransactionRepository from '../repositories/TransactionsRepository';

class DeleteTransactionService {
  public async execute(id: string): Promise<void> {
    const transactionRepository = getCustomRepository(TransactionRepository);

    const transaction = await transactionRepository.findOne(id);

    // Se não encontrou a transação
    if (!transaction) {
      throw new AppError('Transaction does nor exist');
    }

    // Se encontrou, exclui a transação
    await transactionRepository.remove(transaction);
  }
}

export default DeleteTransactionService;
