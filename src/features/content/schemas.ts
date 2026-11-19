import { z } from 'zod';
import { safeCmsHref, validCmsSlug } from './safety.mjs';

const plain = (max: number) => z.string().trim().min(1).max(max).refine(v=>!/[<>]/.test(v) && !/javascript:|data:|onerror|onload/i.test(v),'Use plain text, not HTML or scripts');
const base = {
 id:z.string().uuid(), schemaVersion:z.literal(1), position:z.number().int().min(0).max(15),
 isVisible:z.boolean(), entityRefs:z.array(z.string().uuid()).max(0).optional()
};
const heading = plain(180);
const body = plain(1000);
const optionalUrl = z.string().max(300).refine(safeCmsHref,'Unsafe link').optional();
const hero = z.object({...base,type:z.literal('hero'),variant:z.enum(['editorial','split']),content:z.object({title:heading,body:body.optional(),href:optionalUrl,linkLabel:plain(50).optional(),mediaId:z.string().uuid().optional()}).strict()}).strict();
const intro = z.object({...base,type:z.literal('intro'),variant:z.enum(['prose','aside']),content:z.object({title:heading,body}).strict()}).strict();
const featureGrid = z.object({...base,type:z.literal('featureGrid'),variant:z.enum(['two','three']),content:z.object({title:heading.optional(),items:z.array(z.object({title:plain(120),body:plain(500)}).strict()).min(1).max(6)}).strict()}).strict();
const richText = z.object({...base,type:z.literal('richText'),variant:z.enum(['prose','wide']),content:z.object({paragraphs:z.array(z.object({text:plain(2000)}).strict()).min(1).max(20)}).strict()}).strict();
const faq = z.object({...base,type:z.literal('faq'),variant:z.literal('stack'),content:z.object({items:z.array(z.object({question:plain(180),answer:plain(1600)}).strict()).min(1).max(12)}).strict()}).strict();
const contact = z.object({...base,type:z.literal('contactInvitation'),variant:z.enum(['quiet','highlight']),content:z.object({title:heading,body:body.optional(),href:optionalUrl,linkLabel:plain(50).optional()}).strict()}).strict();
export const contentBlockSchema = z.discriminatedUnion('type',[hero,intro,featureGrid,richText,faq,contact]);
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export const enabledC06Blocks = ['hero','intro','featureGrid','richText','faq','contactInvitation'] as const;
export const reservedBlockFamilies = ['serviceLedger','projectShowcase','verifiedMetrics','courseShelf','bookShelf','programPanel','journalShowcase','journalFinderTeaser','timeline','teamPreview'] as const;
const placement:Record<string,readonly string[]> = {
 hero:['landing','standard'],intro:['landing','standard','editorial'],featureGrid:['landing','standard'],
 richText:['landing','standard','editorial'],faq:['landing','standard','editorial'],contactInvitation:['landing','standard','editorial']
};
const countLimit:Record<string,number>={hero:1,intro:3,featureGrid:2,richText:8,faq:2,contactInvitation:1};
const blocksSchema = z.array(contentBlockSchema).min(1).max(16).superRefine((blocks,ctx)=>{
 const seen=new Set<string>();const counts=new Map<string,number>();
 for(const [i,b] of blocks.entries()){
  if(b.position!==i)ctx.addIssue({code:'custom',path:[i,'position'],message:'Positions must be contiguous and start at zero'});
  if(seen.has(b.id))ctx.addIssue({code:'custom',path:[i,'id'],message:'Block IDs must be unique'});
  seen.add(b.id);counts.set(b.type,(counts.get(b.type)||0)+1);
  if((counts.get(b.type)||0)>countLimit[b.type])ctx.addIssue({code:'custom',path:[i,'type'],message:'Too many blocks of this type'});
 }
});
export const createRevisionSchema = z.object({
 entityId:z.string().uuid(),locale:z.enum(['en','bn']),expectedVersion:z.number().int().nonnegative(),
 slug:z.string().refine(validCmsSlug,'Reserved/invalid slug'),title:heading,
 summary:z.string().max(340),translationStatus:z.enum(['in_progress','reviewed']),privateNotes:z.string().max(1500).default(''),
 blocks:blocksSchema
}).strict();
export const publishedPageSchema = z.object({
 entityId:z.string().uuid(),locale:z.enum(['en','bn']),slug:z.string().refine(validCmsSlug),
 template:z.enum(['landing','standard','editorial']),title:heading,summary:z.string().max(340),
 schemaVersion:z.literal(1),blocks:blocksSchema
}).strict().superRefine((p,ctx)=>{
 for(const [i,b] of p.blocks.entries()){
  if(!placement[b.type].includes(p.template))ctx.addIssue({code:'custom',path:['blocks',i],message:'Block does not belong in this template'});
 }
});
export type PublishedPage = z.infer<typeof publishedPageSchema>;
export const mediaMetadataSchema = z.object({
 rightsHolder:plain(180).refine(s=>s.length>=3),license:plain(120).refine(s=>s.length>=3),
 altEn:plain(240).refine(s=>s.length>=5),altBn:z.string().max(240).default(''),
 publicRights:z.boolean(),previous:z.string().uuid().optional()
}).strict();
