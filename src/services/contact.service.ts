import { PrismaClient, Contact, LinkPrecedence } from '@prisma/client';

const prisma = new PrismaClient();

export const identifyContact = async (email?: string, phoneNumber?: string) => {
    // 1. Find all contacts that directly match the incoming email or phone number.
    const matchingContacts = await prisma.contact.findMany({
        where: {
            OR: [
                { email: email || undefined },
                { phoneNumber: phoneNumber || undefined },
            ],
        },
    });

    if (matchingContacts.length === 0) {
        // SCENARIO 1: No existing contacts. Create a new primary contact.
        const newContact = await prisma.contact.create({
            data: { email, phoneNumber, linkPrecedence: 'primary' },
        });
        return formatResponse([newContact]);
    }

    // 2. We have matches. Find the full set of all related contacts.
    // First, gather all known IDs from the initial matches.
    const relatedIds = new Set<number>();
    matchingContacts.forEach(c => {
        relatedIds.add(c.id);
        if (c.linkedId) relatedIds.add(c.linkedId);
    });

    // Fetch the complete contact group, sorted by creation date (oldest first).
    let allContactsInGroup = await prisma.contact.findMany({
        where: {
            OR: [
                { id: { in: Array.from(relatedIds) } },
                { linkedId: { in: Array.from(relatedIds) } },
            ]
        },
        orderBy: { createdAt: 'asc' },
    });

    const primaryContact = allContactsInGroup[0];  // The oldest contact is the true primary.
    
    // SCENARIO 2: A merge is required. 
    // Check if there's more than one primary contact in our group.
    const primaryContactsInGroup = allContactsInGroup.filter(c => c.linkPrecedence === 'primary');

    if (primaryContactsInGroup.length > 1) {
        // Find the one to keep (the oldest) and the ones to demote.
        const primaryToKeep = primaryContactsInGroup[0];
        const idsToDemote = primaryContactsInGroup.slice(1).map(c => c.id);

        await prisma.contact.updateMany({
            where: { id: { in: idsToDemote } },
            data: {
                linkedId: primaryToKeep.id,
                linkPrecedence: 'secondary',
            },
        });
        // This ensures our local data is fresh before proceeding.
        allContactsInGroup = await prisma.contact.findMany({
            where: { id: { in: allContactsInGroup.map(c => c.id) } },
            orderBy: { createdAt: 'asc' },
        });
    }

    //  SCENARIO 3: New information is being added.

    // Check if the request contains an email or phone not already in our group.
    const allEmails = new Set(allContactsInGroup.map(c => c.email).filter(Boolean));
    const allPhones = new Set(allContactsInGroup.map(c => c.phoneNumber).filter(Boolean));
    const isNewInfo = (email && !allEmails.has(email)) || (phoneNumber && !allPhones.has(phoneNumber));
    
    // Do not create a new contact if the exact same info already exists.
    const isDuplicate = matchingContacts.some(c => c.email === email && c.phoneNumber === phoneNumber);

    if (isNewInfo && !isDuplicate) {
        const newSecondaryContact = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkedId: primaryContact.id,
                linkPrecedence: 'secondary',
            },
        });
        allContactsInGroup.push(newSecondaryContact);
    }
    
    // Format and return the final, consolidated contact.
    return formatResponse(allContactsInGroup);
};


// Helper to format the final response.
const formatResponse = (contacts: Contact[]) => {
    const primaryContact = contacts.find(c => c.linkPrecedence === 'primary')!;

    const emails = [...new Set(contacts.map(c => c.email).filter(Boolean))];
    const phoneNumbers = [...new Set(contacts.map(c => c.phoneNumber).filter(Boolean))];
    
    const secondaryContactIds = contacts
        .filter(c => c.id !== primaryContact.id)
        .map(c => c.id);

    return {
        contact: {
            primaryContactId: primaryContact.id,
            emails: emails,
            phoneNumbers: phoneNumbers,
            secondaryContactIds: secondaryContactIds,
        },
    };
};