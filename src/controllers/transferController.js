import * as transferService from '../services/transferService.js';

export const transferMoneyHandler = async (req, res, next) => {
  try {
    const { from_account_id, to_account_id, amount, reference_id, description } = req.body;

    const result = await transferService.transferMoney({
      from_account_id,
      to_account_id,
      amount,
      reference_id,
      description
    });

    return res.status(200).json({
      success: true,
      message: 'Money transfer completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
