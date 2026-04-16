import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { S3Client, PutObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { SupplierLogFlight } from 'src/shared/entities/supplier-log-flight.entity';
import { Generic } from './generic.utility';
import { GenericRepo } from './generic-repo.utility';
import { BlobServiceClient } from '@azure/storage-blob';

/**
 * Supplier Log Utility Service
 * Provides functionality to store supplier logs to S3, local filesystem, and database
 * @author: Prashant Joshi at 13-10-2025
 */
@Injectable()
export class SupplierLogUtility {
    private readonly supplierLogRepository: Repository<SupplierLogFlight>;

    constructor(
        private readonly configService: ConfigService,
        private readonly genericRepo: GenericRepo,
        private readonly dataSource: DataSource,
    ) {
        this.supplierLogRepository = this.dataSource.getRepository(SupplierLogFlight);
    }

    /** [@Description: Store logs to S3/local and save path to supplier_log_flight table]
     * @author: Prashant Joshi at 13-10-2025 **/
    async generateLogFile(logParams) {
        const { fileName, logData, folderName, logId, title, searchReqId, bookingReferenceId } = logParams;
        const { filePath, storageType } = await this.storeLogFile(fileName, logData, folderName);

        if (filePath && title && searchReqId) {
            await this.saveToSupplierLogTable(logId, title, searchReqId, bookingReferenceId, fileName, filePath, storageType);
        }
    }

    /** [@Description: Store log file to S3 or local filesystem]
     * @author: Prashant Joshi at 13-10-2025 **/
    async storeLogFile(fileName, logData, folderName) {
        let filePath = '';
        let storageType = '';

        // const result = await this.storeToS3(fileName, logData, folderName);
        await this.storeLocally(fileName, logData, folderName);
        const result = await this.storeToAzure(fileName, logData, folderName);
        filePath = result.filePath;
        storageType = result.storageType;

        // /* Run the code only in production server */
        // if (process.env.NODE_ENV == 'production') {
        //     // const result = await this.storeToS3(fileName, logData, folderName);
        //     // filePath = result.filePath;
        //     // storageType = result.storageType;
        // } else {
        //     const result = await this.storeLocally(fileName, logData, folderName);
        //     // filePath = result.filePath;
        //     // storageType = result.storageType;
        // }

        return { filePath, storageType };
    }

    /** [@Description: Store logs to S3 bucket]
     * @author: Prashant Joshi at 13-10-2025 **/
    async storeToS3(fileName, logData, folderName) {
        const bucketPath = 'logs/flight_logs/' + folderName + '/';
        let filePath = '';
        let storageType = '';

        try {
            const AWSCredentials = {
                accessKey: this.configService.get('s3.accesskey'),
                secret: this.configService.get('s3.secretKey'),
                bucketName: this.configService.get('s3.bucketName'),
                region: this.configService.get('s3.awsRegion'),
            };

            const s3Client = new S3Client({
                region: AWSCredentials.region, // specify your AWS region
                credentials: {
                    accessKeyId: AWSCredentials.accessKey,
                    secretAccessKey: AWSCredentials.secret,
                },
            });

            // Setting up S3 upload parameters
            const params = {
                Bucket: AWSCredentials.bucketName,
                Body: JSON.stringify(logData),
                Key: bucketPath + fileName + '.json',
                ACL: ObjectCannedACL.public_read,
                ContentType: 'text/html',
            };

            // Uploading files to the bucket
            const command = new PutObjectCommand(params);
            try {
                await s3Client.send(command);
                filePath = `${this.configService.get('s3.cloudfrontUrl')}/${bucketPath}${fileName}.json`;
                storageType = 's3';
            } catch (err) {
                // Error logging
                console.log(err);
                this.genericRepo.storeLogs('', 1, err, 0);
            }
        } catch (error) {
            console.log(error);
            /* error logging */
            this.genericRepo.storeLogs('', 1, error, 0);
        }

        return { filePath, storageType };
    }

    /** [@Description: Store logs to Azure Blob]
     * @author: Vedant at 15-10-2025 **/
    async storeToAzure(fileName: string, logData: any, folderName: string) {
        const folderPath = `logs/flight_logs/${folderName}/`;
        let filePath = '';
        let storageType = '';

        try {
            const sasUrl = this.configService.get('azure.blob_sas_link');

            if (!sasUrl) throw new Error('Azure Blob SAS link missing in configuration.');

            const blobServiceClient = new BlobServiceClient(sasUrl);

            const url = new URL(sasUrl);
            const containerName = url.pathname.replace('/', '');

            const containerClient = blobServiceClient.getContainerClient(containerName);

            const blobName = `${folderPath}${fileName}.json`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            await blockBlobClient.uploadData(Buffer.from(JSON.stringify(logData, null, 2)), {
                blobHTTPHeaders: { blobContentType: 'application/json' },
            });

            filePath = blockBlobClient.url;
            storageType = 'azure';
        } catch (error: any) {
            console.log(error);
        }

        return { filePath, storageType };
    }

    /** [@Description: Store logs to local filesystem]
     * @author: Prashant Joshi at 13-10-2025 **/
    async storeLocally(fileName, logData, folderName) {
        let filePath = '';
        let storageType = '';

        try {
            /* Store the logs in server only */
            Generic.generateLogFile(fileName, logData, folderName);

            // Get local file path
            const projectPath = process.cwd();
            const logsPath = path.join(projectPath, '../', 'logs/flight/', folderName, '/');
            filePath = path.join(logsPath, fileName + '.json');
            storageType = 'local';
        } catch (error) {
            console.log('Error storing locally:', error);
            this.genericRepo.storeLogs('', 1, error, 0);
        }

        return { filePath, storageType };
    }

    /** [@Description: Save log entry to supplier_log_flight table]
     * @author: Prashant Joshi at 13-10-2025 **/
    async saveToSupplierLogTable(logId, title, searchReqId, bookingReferenceId, fileName, filePath, storageType) {
        try {
            const supplierLogEntry = new SupplierLogFlight();
            supplierLogEntry.log_id = logId;
            supplierLogEntry.title = title;
            supplierLogEntry.search_req_id = searchReqId;
            supplierLogEntry.booking_reference_id = bookingReferenceId;
            // supplierLogEntry.path_url = {
            //     s3Path: storageType === 's3' ? filePath : undefined,
            //     localPath: storageType === 'local' ? filePath : undefined,
            //     storageType: storageType,
            //     fileName: fileName,
            //     storedAt: new Date().toISOString(),
            // };
            supplierLogEntry.path_url = filePath;
            await this.supplierLogRepository.save(supplierLogEntry);
        } catch (error) {
            this.genericRepo.storeLogs('', 1, error, 0);
        }
    }
}
