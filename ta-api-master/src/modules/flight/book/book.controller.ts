import { Controller, Post, Body, UseGuards, Headers } from '@nestjs/common';
import { BookService } from './book.service';
import { BookConfirmationDto, BookDto } from './dtos/book.dto';
import {
    SWG_BAD_REQUEST_RESPONSE,
    SWG_INTERNAL_SERVER_ERROR_RESPONSE,
    SWG_NOT_FOUND_RESPONSE,
    SWG_SUCCESS_RESPONSE,
    SWG_UNPROCESSABLE_RESPONSE,
} from 'src/shared/constants/standard-api-responses.constant';
import { RequiredHeaders } from 'src/shared/decorators/common/custom-header.decorator';
import {
    DEC_HEADER_API_VERSION_MANDATE,
    DEC_HEADER_CURRENCY_PREFERENCE_MANDATE,
    DEC_HEADER_IP_ADDRESS_MANDATE,
    SWG_HEADER_API_VERSION_MANDATE,
    SWG_HEADER_CURRENCY_PREFERENCE,
    SWG_HEADER_IP_MANDATE,
} from 'src/shared/constants/standard-api-headers.constant';
import { HeaderValidationGuard } from 'src/shared/guards/common/header.validation.guard';
import { ApiHeaders, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Flight')
@UseGuards(HeaderValidationGuard)
@ApiHeaders([SWG_HEADER_CURRENCY_PREFERENCE, SWG_HEADER_IP_MANDATE, SWG_HEADER_API_VERSION_MANDATE])
@RequiredHeaders([DEC_HEADER_API_VERSION_MANDATE, DEC_HEADER_CURRENCY_PREFERENCE_MANDATE, DEC_HEADER_IP_ADDRESS_MANDATE])
@Controller('/flight')
export class BookController {
    constructor(private readonly bookService: BookService) {}

    @Post('book/initiate')
    @ApiOperation({ summary: 'Book a flight' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async bookingInitiate(@Body() bookDto: BookDto, @Headers() headers: Headers) {
        return this.bookService.bookingInitiate({ bookReq: bookDto, headers });
    }

    @Post('book/confirmation')
    @ApiOperation({ summary: 'Book a flight' })
    @ApiResponse(SWG_SUCCESS_RESPONSE)
    @ApiResponse(SWG_NOT_FOUND_RESPONSE)
    @ApiResponse(SWG_BAD_REQUEST_RESPONSE)
    @ApiResponse(SWG_UNPROCESSABLE_RESPONSE)
    @ApiResponse(SWG_INTERNAL_SERVER_ERROR_RESPONSE)
    async bookingConfirmation(@Body() bookDto: BookConfirmationDto, @Headers() headers: Headers) {
        return this.bookService.bookingConfirmation({ bookReq: bookDto, headers });
    }
}
