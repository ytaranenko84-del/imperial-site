import { S3ClientUploadHandler as S3ClientUploadHandler_s3 } from '@payloadcms/storage-s3/client'
import RowOpen_admin from '../../../components/admin/RowOpen'
import AccountLink_admin from '../../../components/admin/AccountLink'
import { PriceUpload as PriceUpload_e39f6cb35d9940a18c8e6e6841027342 } from '../../../components/PriceUpload'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'

/** @type import('payload').ImportMap */
export const importMap = {
  "/components/PriceUpload#PriceUpload": PriceUpload_e39f6cb35d9940a18c8e6e6841027342,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1,
  "/components/admin/RowOpen#default": RowOpen_admin,
  "/components/admin/AccountLink#default": AccountLink_admin,
  "@payloadcms/storage-s3/client#S3ClientUploadHandler": S3ClientUploadHandler_s3
}
