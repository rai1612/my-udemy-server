import jwt from "jsonwebtoken";
import { catchAsyncError } from "./catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { User } from "../models/User.js";

export const isAuthenticated = catchAsyncError(async (req, res, next) => {
  const { token } = req.cookies;
  // console.log(token);

  if (!token) return next(new ErrorHandler("Please login first", 401));

  // decoded will be an object with property _id which was used to generate token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  req.user = await User.findById(decoded._id);

  // Go to next middleware
  next();
});

export const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return next(
      new ErrorHandler(
        `${req.user.role} is not allowed to access this resource`,
        403
      )
    );
  next();
};
export const authorizeSubscribers = (req, res, next) => {
  if (req.user.role === "user" && req.user.subscription === undefined)
    return next(
      new ErrorHandler("Only subscribers can access this resource", 403)
    );
  next();
};
