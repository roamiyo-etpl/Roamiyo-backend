import { BookingStatus } from "src/shared/enums/flight/booking.enum";
import { OrderDetailResponse } from "../../order-details/interfaces/order-detail.interface";
import { RefundablePerPnr } from "./reconcile.interface";
import { Fare } from "../../search/interfaces/start-routing.interface";

export class Order {
  orderNo: string;
  pnr?: string;
  orderAmount: number;
  currency: string;
  orderStatus: BookingStatus;
  isPriceChanged: boolean;
  isScheduleChanged: boolean;
  fareType: string;
  supplierBaseAmount?: string | null;
}

export class BookResponse {
  error: boolean;
  message: string;
  mode: string;
  searchReqId: string;
  supplierMessage?: string;
  orderDetail: Order[];
  orderDetails?: OrderDetailResponse;
  supplierOrderDetailResponse?: any[];
  /** Raw response from supplier (TBO, etc.). */
  rawSupplierResponse?: any;
  /** Per-PNR refundability so the booking screen can show/hide "Cancel booking". */
  is_refundable?: RefundablePerPnr[];
}

export class BookInitiateResponse {
  error: boolean;
  message: string;
  booking_log_id: string;
  search_req_id: string;
  booking_id: string;
  fare: Fare;
  payableAmount?: number;
  ssrTotal?: number;
  /** TBO FareQuote (IndiGo): seat may be omitted at ticket if sold out when true. */
  isBookableIfSeatNotAvailable?: boolean;
  /** Value sent on TBO Book/Ticket when IndiGo + seats selected. */
  isAllowBookingWithoutSeat?: boolean;
}
