import {isexe, sync as isexeSync} from 'isexe';
import {x, xSync} from 'tinyexec';

const binCheck = async (bin, args) => {
	if (!Array.isArray(args)) {
		args = ['--help'];
	}

	const works = await isexe(bin);
	if (!works) {
		throw new Error(`Couldn't execute the "${bin}" binary. Make sure it has the right permissions.`);
	}

	try {
		const result = await x(bin, args, {nodePath: false});
		return result.exitCode === 0;
	} catch {
		return false;
	}
};

binCheck.sync = (bin, args) => {
	if (!Array.isArray(args)) {
		args = ['--help'];
	}

	if (!isexeSync(bin)) {
		throw new Error(`Couldn't execute the "${bin}" binary. Make sure it has the right permissions.`);
	}

	try {
		return xSync(bin, args, {nodePath: false}).exitCode === 0;
	} catch {
		return false;
	}
};

export default binCheck;
