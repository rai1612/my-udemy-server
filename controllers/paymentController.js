import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/User.js";
import { Payment } from "../models/Payment.js";
import ErrorHandler from "../utils/errorHandler.js";
import { instance } from "../server.js";
import crypto from "crypto";

export const buySubscription = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (user.role === "admin")
    return next(new ErrorHandler("Admin can't buy subscriptions", 404));

  const plan_id = process.env.PLAN_ID || "plan_M54NEuZMda1jps";

  const subscription = await instance.subscriptions.create({
    plan_id,
    customer_notify: 1,
    total_count: 12,
  });

  user.subscription.id = subscription.id;
  user.subscription.status = subscription.status;

  await user.save();

  res.status(201).json({
    success: true,
    subscriptionId: subscription.id,
  });
});

// this function gets called by the razorpay severs as callback
export const paymentVerification = catchAsyncError(async (req, res, next) => {
  const { razorpay_signature, razorpay_payment_id, razorpay_subscription_id } =
    req.body;

  const user = await User.findById(req.user._id);

  const subscription_id = user.subscription.id;

  // creating our signature according to razorpay from the payment id
  const generated_signature = crypto
    .createHmax("sha256", process.env.RAZORPAY_API_SECRET)
    .update(razorpay_payment_id + "|" + subscription_id, "utf-8")
    .digest("hex");

  const isAuthentic = generated_signature === razorpay_signature;

  if (!isAuthentic) res.redirect(`${process.env.FRONTEND_URL}/paymentfail`);

  // data base comes here

  await Payment.create({
    razorpay_signature,
    razorpay_payment_id,
    razorpay_subscription_id,
  });

  user.subscription.status = "active";

  await user.save();

  res.redirect(
    `${process.env.FRONTEND_URL}/paymentsuccess?=${razorpay_payment_id}`
  );
});

export const getRazorpayKey = catchAsyncError(async (req, res, next) => {
  res.status(200).json({
    success: true,
    key: process.env.RAZORPAY_API_KEY,
  });
});
export const cancelSubscription = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  const subscriptionId = user.subscription.id;

  let refund = false;

  // cancel the subscription on razorpay
  await instance.subscriptions.cancel(subscriptionId);

  // find the details of the payment
  const payment = await Payment.findOne({
    razorpay_subscription_id: subscriptionId,
  });

  // check for refund applicability
  const gap = Date.now() - payment.createdAt;
  const refundTime = process.env.REFUND_DAYS * 24 * 60 * 60 * 1000;
  if (refundTime > gap) {
    await instance.payment.refund(payment.razorpay_payment_id);
    refund = true;
  }
  // remove the subscription details
  await Payment.findOneAndRemove({ razorpay_subscription_id: subscriptionId });
  user.subscription.id = undefined;
  user.subscription.status = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: refund
      ? "Subscription cancelled. Payment will be refunded within 7 days."
      : "Subscription cancelled. No refund will be initiated as subscription was cancelled after 7 days.",
  });
});
