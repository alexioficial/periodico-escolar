import { ObjectId } from 'mongodb';

export async function createDirectLoginSession(
	id: string,
	findUser: (id: ObjectId) => Promise<{ _id: ObjectId } | null>,
	issueSession: (id: ObjectId) => Promise<string>
): Promise<string | null> {
	if (!/^[a-f\d]{24}$/i.test(id)) return null;
	const user = await findUser(new ObjectId(id));
	if (!user) return null;
	return issueSession(user._id);
}
