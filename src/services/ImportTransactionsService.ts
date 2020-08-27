import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface TransactionsCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    // Cria arquivo de leitura na memória
    const transactionsReadStream = fs.createReadStream(filePath);

    // Cria instância do csv parse
    const parsers = csvParse({
      from_line: 2,
    });

    // Arrays onde serão armazenados as informações do CSV
    const transactionsList: TransactionsCSV[] = [];
    const categoriesList: string[] = [];

    // Converte o arquivo na memória para CSV e coloca em um objeto
    const parseCSV = transactionsReadStream.pipe(parsers);

    // Faz a leitura mapeando o CSV
    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      // Se faltar alguma informação, não adiciona a linha no array
      if (!title || !type || !value) return;

      // Se houver todas as informações adiciona a transação no array
      categoriesList.push(category);
      transactionsList.push({ title, type, value, category });
    });

    // Cria um promise para aguardar o processamento do CSV
    await new Promise(resolve => parseCSV.on('end', resolve));

    /*
     * Checa se as categorias existem no banco
     * criando uma lista com as categorias que já existem;
     * Cria uma lista das categorias que não existem
     */

    // Lista das categorias que já existem no banco
    const existentCategories = await categoryRepository.find({
      where: {
        title: In(categoriesList),
      },
    });

    // Lista de títulos das categorias que já existem
    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    // Lista de categorias que não existem no banco
    const nonExistentCategories = categoriesList
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    // Adiciona as novas categorias no banco
    const newCategories = categoryRepository.create(
      nonExistentCategories.map(title => ({
        title,
      })),
    );

    await categoryRepository.save(newCategories);

    // Recebe todas as categorias
    const allCategories = [...newCategories, ...existentCategories];

    // Cria todas as transações do arquivo CSV
    const createdTransactions = transactionsRepository.create(
      transactionsList.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(category => category.title),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    // Exclui o arquivo do servidor
    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
