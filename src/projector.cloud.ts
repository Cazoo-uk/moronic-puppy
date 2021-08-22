import { Readable } from 'stream'
import { EventMetadata } from '.'
import { Archive } from './projector'
import { S3, ListObjectsV2CommandInput, GetObjectCommandInput } from '@aws-sdk/client-s3'
import { createGunzip } from 'zlib'
import { chain } from 'stream-chain'
import * as StreamValues from 'stream-json/streamers/StreamValues'

interface S3SourceParams {
    bucket: string
    client?: S3
}

export function readS3<TEvent extends EventMetadata>(params: S3SourceParams): Archive<TEvent> {
    return async function*(currentChunk: string) {
        const client = params.client || new S3({})
        for await (const file of listFiles(params.bucket, client, currentChunk)) {
            if (file === undefined) continue;
            const events = await readEvents<TEvent>(file, params.bucket, client);

            yield {
                id: file,
                events
            }
        }
    }
}

const eventFrom = (e: any) => ({
    type: e.TYPE.S,
    stream: e.PK.S.substr(7),
    sequence: parseInt(e.SK.S.substr(1)),
    id: e.ID.S,
    payload: JSON.parse(e.DATA.S)
})

async function readEvents<TEvent>(key: string, bucket: string, client: S3): Promise<Array<TEvent>> {
    const params: GetObjectCommandInput = {
        Bucket: bucket,
        Key: key
    }

    const result = [];
    const data = await client.getObject(params)
    if(undefined === data.Body)
        throw new Error("Missing archive object "+key+ "in " + bucket)

    const pipeline = chain([
        data.Body as Readable,
        createGunzip(),
        StreamValues.withParser(),
        e => eventFrom(e.value.dynamodb.NewImage)
    ])

    for await (const e of pipeline){
        console.log(e)
      result.push(e)
    }

    return result;
}

async function* listFiles(bucket: string, client: S3, marker: string) {
    const opts: ListObjectsV2CommandInput = {
        Bucket: bucket,
        StartAfter: marker,
    }
    do {
        const data = await client.listObjectsV2(opts);
        opts.ContinuationToken = data.NextContinuationToken;
        if (data.Contents === undefined)
            break;
        for (const o of data.Contents) {
            yield o.Key;
        }
    } while (opts.ContinuationToken)
}
